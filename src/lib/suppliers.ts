import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { orderInclude, toPurchaseOrderDTO } from "@/lib/purchase-orders";
import { toDateOnly } from "@/utils/format";
import type {
  PurchaseOrderDTO,
  SupplierDTO,
  SupplierMoneyDTO,
  SupplierPaymentDTO,
} from "@/types/entities";

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);

// Shape returned by supplier queries. Kept structural (not a Prisma payload
// type) so create/update rows map through the same function.
type SupplierRow = {
  supplierId: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
};

type SupplierStats = {
  itemCount: number;
  money: SupplierMoneyDTO;
};

export function toSupplierDTO(
  s: SupplierRow,
  stats?: SupplierStats,
): SupplierDTO {
  const dto: SupplierDTO = {
    supplierId: s.supplierId,
    name: s.name,
    contactPerson: s.contactPerson,
    phone: s.phone,
    email: s.email,
    notes: s.notes,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
  };
  if (stats) {
    dto.itemCount = stats.itemCount;
    dto.money = stats.money;
  }
  return dto;
}

export const supplierPaymentInclude = {
  creator: { select: { firstName: true, lastName: true } },
  order: { select: { orderId: true, reference: true } },
} as const;

type PaymentRow = Prisma.SupplierPaymentGetPayload<{
  include: typeof supplierPaymentInclude;
}>;

export function toSupplierPaymentDTO(p: PaymentRow): SupplierPaymentDTO {
  return {
    paymentId: p.paymentId,
    supplierId: p.supplierId,
    orderId: p.orderId,
    orderReference: p.order
      ? p.order.reference || `Order #${p.order.orderId}`
      : null,
    amount: p.amount.toFixed(2),
    paidOn: toDateOnly(p.paidOn) ?? "",
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    createdByName: p.creator
      ? `${p.creator.firstName} ${p.creator.lastName}`
      : null,
    createdAt: p.createdAt.toISOString(),
  };
}

// ---- Balance ----

// Statuses whose value counts as billed. Received means the delivery is settled,
// whether everything arrived or the order was closed short. Draft, Placed and
// Partial are still in progress: the supplier has not finished delivering, so
// there is no bill to owe against yet.
const INVOICED_STATUS = "Received";
const OPEN_STATUSES = ["Draft", "Placed", "Partial"];

// An order's value, matching exactly what the order page shows: lines at the
// quantity ordered, plus the charges. For a fully delivered order that is also
// what arrived. For one closed short it is what was asked for rather than what
// came, so a short-shipped order reads high until its lines are corrected.
function orderValue(order: {
  lines: { quantityOrdered: Prisma.Decimal; unitCost: Prisma.Decimal | null }[];
  discountAmount: Prisma.Decimal | null;
  shippingAmount: Prisma.Decimal | null;
  taxAmount: Prisma.Decimal | null;
}): Prisma.Decimal {
  const subtotal = order.lines.reduce(
    (sum, l) =>
      l.unitCost ? sum.plus(l.quantityOrdered.times(l.unitCost)) : sum,
    D(0),
  );
  return subtotal
    .minus(order.discountAmount ?? 0)
    .plus(order.shippingAmount ?? 0)
    .plus(order.taxAmount ?? 0);
}

const balanceOrderSelect = {
  supplierId: true,
  status: true,
  discountAmount: true,
  shippingAmount: true,
  taxAmount: true,
  lines: { select: { quantityOrdered: true, unitCost: true } },
} as const;

type BalanceOrderRow = Prisma.PurchaseOrderGetPayload<{
  select: typeof balanceOrderSelect;
}>;

function toMoneyDTO(
  orders: BalanceOrderRow[],
  paid: Prisma.Decimal,
): SupplierMoneyDTO {
  let invoiced = D(0);
  let inProgress = D(0);
  let orderCount = 0;
  let openOrderCount = 0;

  for (const order of orders) {
    const value = orderValue(order);
    if (order.status === INVOICED_STATUS) {
      invoiced = invoiced.plus(value);
      orderCount += 1;
    } else if (OPEN_STATUSES.includes(order.status)) {
      inProgress = inProgress.plus(value);
      openOrderCount += 1;
    }
    // Cancelled orders are neither: nothing was delivered and nothing is owed.
  }

  return {
    invoiced: invoiced.toFixed(2),
    paid: paid.toFixed(2),
    balance: invoiced.minus(paid).toFixed(2),
    inProgress: inProgress.toFixed(2),
    orderCount,
    openOrderCount,
  };
}

// ---- Reads ----

// All suppliers with item counts and their balance. Inactive suppliers sort last
// but stay visible, since their history still matters.
export async function getSuppliersWithStats(): Promise<SupplierDTO[]> {
  const [suppliers, itemGroups, orders, paidGroups] = await Promise.all([
    prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.inventoryItem.groupBy({
      by: ["supplierId"],
      where: { supplierId: { not: null }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { deletedAt: null, supplierId: { not: null } },
      select: balanceOrderSelect,
    }),
    prisma.supplierPayment.groupBy({
      by: ["supplierId"],
      where: { deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const itemMap = new Map(itemGroups.map((g) => [g.supplierId, g._count._all]));
  const paidMap = new Map(
    paidGroups.map((g) => [g.supplierId, g._sum.amount ?? D(0)]),
  );

  const ordersBySupplier = new Map<number, BalanceOrderRow[]>();
  for (const order of orders) {
    if (order.supplierId == null) continue;
    const bucket = ordersBySupplier.get(order.supplierId);
    if (bucket) bucket.push(order);
    else ordersBySupplier.set(order.supplierId, [order]);
  }

  return suppliers.map((s) =>
    toSupplierDTO(s, {
      itemCount: itemMap.get(s.supplierId) ?? 0,
      money: toMoneyDTO(
        ordersBySupplier.get(s.supplierId) ?? [],
        paidMap.get(s.supplierId) ?? D(0),
      ),
    }),
  );
}

// Active suppliers only, for the inventory item picker (no stats needed).
export async function getActiveSuppliers(): Promise<SupplierDTO[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
  });
  return suppliers.map((s) => toSupplierDTO(s));
}

export async function getSupplier(
  supplierId: number,
): Promise<SupplierDTO | null> {
  const supplier = await prisma.supplier.findFirst({
    where: { supplierId, deletedAt: null },
  });
  if (!supplier) return null;

  const [itemCount, orders, paidAgg] = await Promise.all([
    prisma.inventoryItem.count({ where: { supplierId, deletedAt: null } }),
    prisma.purchaseOrder.findMany({
      where: { supplierId, deletedAt: null },
      select: balanceOrderSelect,
    }),
    prisma.supplierPayment.aggregate({
      _sum: { amount: true },
      where: { supplierId, deletedAt: null },
    }),
  ]);

  return toSupplierDTO(supplier, {
    itemCount,
    money: toMoneyDTO(orders, paidAgg._sum.amount ?? D(0)),
  });
}

export interface SupplierDetailData {
  supplier: SupplierDTO;
  orders: PurchaseOrderDTO[];
  payments: SupplierPaymentDTO[];
}

export async function getSupplierDetail(
  supplierId: number,
): Promise<SupplierDetailData | null> {
  const supplier = await getSupplier(supplierId);
  if (!supplier) return null;

  const [orders, payments] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { supplierId, deletedAt: null },
      include: orderInclude,
      orderBy: [{ createdAt: "desc" }, { orderId: "desc" }],
    }),
    prisma.supplierPayment.findMany({
      where: { supplierId, deletedAt: null },
      include: supplierPaymentInclude,
      orderBy: [{ paidOn: "desc" }, { paymentId: "desc" }],
    }),
  ]);

  return {
    supplier,
    orders: orders.map((o) => toPurchaseOrderDTO(o)),
    payments: payments.map(toSupplierPaymentDTO),
  };
}

// Received orders, for the "which bill is this settling?" picker on the payment
// form. Open orders are excluded: there is no bill to pay yet.
export async function getPayableOrders(
  supplierId: number,
): Promise<PurchaseOrderDTO[]> {
  const orders = await prisma.purchaseOrder.findMany({
    where: { supplierId, deletedAt: null, status: INVOICED_STATUS },
    include: orderInclude,
    orderBy: [{ receivedOn: "desc" }, { orderId: "desc" }],
  });
  return orders.map((o) => toPurchaseOrderDTO(o));
}
