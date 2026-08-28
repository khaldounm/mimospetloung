import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { orderInclude, toPurchaseOrderDTO } from "@/lib/purchase-orders";
import { toDateOnly } from "@/utils/format";
import type {
  PurchaseOrderDTO,
  SupplierContactDTO,
  SupplierDTO,
  SupplierMoneyDTO,
  SupplierPaymentDTO,
} from "@/types/entities";
import type {
  SupplierContactInput,
  SupplierCreditInput,
} from "@/schemas/supplier";
import type { SupplierSettlementKind } from "@/constants/supplier";

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);

// Contacts in the order the form laid them out, so the repeater round-trips
// unchanged and the first row is a stable fallback for the primary.
export const supplierInclude = {
  contacts: { orderBy: [{ sortOrder: "asc" }, { contactId: "asc" }] },
} as const satisfies Prisma.SupplierInclude;

type ContactRow = {
  contactId: number;
  supplierId: number;
  name: string;
  role: string | null;
  categories: string[];
  phone: string | null;
  email: string | null;
  notes: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

// Shape returned by supplier queries. Kept structural (not a Prisma payload
// type) so create/update rows map through the same function.
type SupplierRow = {
  needsReview: boolean;
  reviewNote: string | null;
  supplierId: number;
  name: string;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  contacts: ContactRow[];
};

export function toSupplierContactDTO(c: ContactRow): SupplierContactDTO {
  return {
    contactId: c.contactId,
    supplierId: c.supplierId,
    name: c.name,
    role: c.role,
    categories: c.categories,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    isPrimary: c.isPrimary,
    sortOrder: c.sortOrder,
  };
}

type SupplierStats = {
  itemCount: number;
  money: SupplierMoneyDTO;
};

export function toSupplierDTO(
  s: SupplierRow,
  stats?: SupplierStats,
): SupplierDTO {
  // Falls back to the first contact so a supplier whose rows predate the
  // primary flag, or one saved outside the form, still shows a line of detail
  // rather than "No contact details" beside a populated list.
  const primary = s.contacts.find((c) => c.isPrimary) ?? s.contacts[0] ?? null;

  const dto: SupplierDTO = {
    supplierId: s.supplierId,
    name: s.name,
    needsReview: s.needsReview,
    reviewNote: s.reviewNote,
    contacts: s.contacts.map(toSupplierContactDTO),
    contactPerson: primary?.name ?? null,
    phone: primary?.phone ?? null,
    email: primary?.email ?? null,
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
    kind: (p.kind === "Credit"
      ? "Credit"
      : "Payment") as SupplierSettlementKind,
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    createdByName: p.creator
      ? `${p.creator.firstName} ${p.creator.lastName}`
      : null,
    createdAt: p.createdAt.toISOString(),
  };
}

// ---- Contact writes ----

// Replaces a supplier's contact set in one pass: rows carrying a contactId are
// updated, rows without one are created, and anything absent from the array is
// deleted. Runs inside a transaction, since the set is briefly incomplete.
//
// isPrimary is cleared across the supplier before the chosen row is flagged.
// The partial unique index permits one primary at a time, so flagging the new
// one while the old still holds it would collide, and a unique index cannot be
// deferred to the end of the transaction.
export async function writeSupplierContacts(
  tx: Prisma.TransactionClient,
  supplierId: number,
  contacts: SupplierContactInput[],
): Promise<void> {
  const keptIds = contacts
    .map((c) => c.contactId)
    .filter((id): id is number => id !== undefined);

  await tx.supplierContact.deleteMany({
    where: {
      supplierId,
      ...(keptIds.length > 0 ? { contactId: { notIn: keptIds } } : {}),
    },
  });
  await tx.supplierContact.updateMany({
    where: { supplierId },
    data: { isPrimary: false },
  });

  const ids: number[] = [];
  for (const [index, c] of contacts.entries()) {
    const data = {
      name: c.name,
      role: c.role ?? null,
      categories: c.categories,
      phone: c.phone ?? null,
      email: c.email ?? null,
      notes: c.notes ?? null,
      sortOrder: index,
      isPrimary: false,
    };

    // Scoped by supplierId so an id belonging to another supplier cannot be
    // adopted by editing the payload; a miss falls through to a create.
    let id: number | null = null;
    if (c.contactId !== undefined) {
      const updated = await tx.supplierContact.updateMany({
        where: { contactId: c.contactId, supplierId },
        data,
      });
      if (updated.count > 0) id = c.contactId;
    }
    if (id === null) {
      const created = await tx.supplierContact.create({
        data: { ...data, supplierId },
      });
      id = created.contactId;
    }
    ids.push(id);
  }

  // Whichever row the form flagged, else the first: a supplier that has any
  // contacts always has exactly one primary, which is what the list column and
  // the detail header read.
  const flagged = contacts.findIndex((c) => c.isPrimary);
  const primaryId = ids[flagged === -1 ? 0 : flagged];
  if (primaryId !== undefined) {
    await tx.supplierContact.update({
      where: { contactId: primaryId },
      data: { isPrimary: true },
    });
  }
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

// `opening` is the balance the account was opened with. It has to be in the
// balance or the figure is not merely incomplete, it has the wrong sign:
// Libanvet was paid 6,886.30 against 6,566.45 of orders and read as 319.85
// "in credit" when an opening balance of 937.53 means 617.68 is owed.
function toMoneyDTO(
  orders: BalanceOrderRow[],
  settled: { paid: Prisma.Decimal; credited: Prisma.Decimal },
  opening: Prisma.Decimal,
  openingAsOf: Date | null,
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

  // Both kinds settle the account, so both come off the balance. They are
  // reported apart because only one of them was money: a credit note reduces
  // what is owed without anything leaving the bank, and adding it to "paid"
  // would have the clinic believe it spent what the supplier wrote off.
  const settledTotal = settled.paid.plus(settled.credited);

  return {
    openingBalance: opening.toFixed(2),
    openingBalanceAsOf: openingAsOf ? toDateOnly(openingAsOf) : null,
    invoiced: invoiced.toFixed(2),
    paid: settled.paid.toFixed(2),
    credited: settled.credited.toFixed(2),
    balance: opening.plus(invoiced).minus(settledTotal).toFixed(2),
    inProgress: inProgress.toFixed(2),
    orderCount,
    openOrderCount,
  };
}

// ---- Reads ----

// All suppliers with item counts and their balance. Inactive suppliers sort last
// but stay visible, since their history still matters.
export async function getSuppliersWithStats(): Promise<SupplierDTO[]> {
  const [suppliers, itemGroups, orders, paidGroups, openingGroups] =
    await Promise.all([
      prisma.supplier.findMany({
        where: { deletedAt: null },
        include: supplierInclude,
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
        by: ["supplierId", "kind"],
        where: { deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.openingBalance.findMany({
        where: { supplierId: { not: null } },
        select: { supplierId: true, amount: true, asOfDate: true },
      }),
    ]);

  const itemMap = new Map(itemGroups.map((g) => [g.supplierId, g._count._all]));
  const settledMap = new Map<
    number,
    { paid: Prisma.Decimal; credited: Prisma.Decimal }
  >();
  for (const g of paidGroups) {
    const current = settledMap.get(g.supplierId) ?? {
      paid: D(0),
      credited: D(0),
    };
    const amount = g._sum.amount ?? D(0);
    if (g.kind === "Credit") current.credited = current.credited.plus(amount);
    else current.paid = current.paid.plus(amount);
    settledMap.set(g.supplierId, current);
  }
  // At most one per supplier, so the last write wins harmlessly.
  const openingMap = new Map(openingGroups.map((g) => [g.supplierId, g]));

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
        settledMap.get(s.supplierId) ?? { paid: D(0), credited: D(0) },
        openingMap.get(s.supplierId)?.amount ?? D(0),
        openingMap.get(s.supplierId)?.asOfDate ?? null,
      ),
    }),
  );
}

// Active suppliers only, for the inventory item picker (no stats needed).
export async function getActiveSuppliers(): Promise<SupplierDTO[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null, isActive: true },
    include: supplierInclude,
    orderBy: { name: "asc" },
  });
  return suppliers.map((s) => toSupplierDTO(s));
}

export async function getSupplier(
  supplierId: number,
): Promise<SupplierDTO | null> {
  const supplier = await prisma.supplier.findFirst({
    where: { supplierId, deletedAt: null },
    include: supplierInclude,
  });
  if (!supplier) return null;

  const [itemCount, orders, paidAgg, openingAgg] = await Promise.all([
    prisma.inventoryItem.count({ where: { supplierId, deletedAt: null } }),
    prisma.purchaseOrder.findMany({
      where: { supplierId, deletedAt: null },
      select: balanceOrderSelect,
    }),
    prisma.supplierPayment.groupBy({
      by: ["kind"],
      _sum: { amount: true },
      where: { supplierId, deletedAt: null },
    }),
    prisma.openingBalance.findFirst({
      where: { supplierId },
      orderBy: { asOfDate: "asc" },
      select: { amount: true, asOfDate: true },
    }),
  ]);

  return toSupplierDTO(supplier, {
    itemCount,
    money: toMoneyDTO(
      orders,
      {
        paid: paidAgg.find((g) => g.kind !== "Credit")?._sum.amount ?? D(0),
        credited: paidAgg.find((g) => g.kind === "Credit")?._sum.amount ?? D(0),
      },
      openingAgg?.amount ?? D(0),
      openingAgg?.asOfDate ?? null,
    ),
  });
}

// A supplier's contacts on their own, for the order page's WhatsApp send.
// Deliberately not read off the active-supplier list the page already loads:
// an order can belong to a supplier since marked inactive, and its contacts
// still need to be reachable.
export async function getSupplierContacts(
  supplierId: number,
): Promise<SupplierContactDTO[]> {
  const contacts = await prisma.supplierContact.findMany({
    where: { supplierId },
    orderBy: [{ sortOrder: "asc" }, { contactId: "asc" }],
  });
  return contacts.map(toSupplierContactDTO);
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

// ---- Credit notes ----

// Records one credit note and spreads it across the account in a single
// transaction. The clinic is handed a note for a lump sum and decides at the
// counter where it goes: some against a specific bill, whatever is left over
// against the account.
//
// Each allocation is stored as its own settlement row, sharing the note's number
// in `reference`. That is what makes the statement read correctly: a credit that
// settled two bills genuinely is two entries on the account, and forcing it into
// one row would leave neither bill showing as settled.
//
// One transaction, because a half-applied credit note is worse than none: the
// balance would be right in total while pointing at the wrong orders.
export async function recordSupplierCredit(
  supplierId: number,
  data: SupplierCreditInput,
  performedBy: number | null,
): Promise<number[]> {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { supplierId, deletedAt: null },
      select: { supplierId: true },
    });
    if (!supplier) throw new ApiError(404, "Supplier not found");

    // Every named order has to be this supplier's and actually billed, or the
    // credit would settle a bill that does not exist yet, or one on another
    // account. Checked in one query rather than per allocation.
    const orderIds = data.allocations
      .map((a) => a.orderId)
      .filter((id): id is number => id != null);
    if (orderIds.length > 0) {
      const orders = await tx.purchaseOrder.findMany({
        where: { orderId: { in: orderIds }, supplierId, deletedAt: null },
        select: { orderId: true, status: true },
      });
      const byId = new Map(orders.map((o) => [o.orderId, o]));
      for (const orderId of orderIds) {
        const order = byId.get(orderId);
        if (!order) {
          throw new ApiError(
            404,
            `Order #${orderId} does not belong to this supplier`,
          );
        }
        if (order.status !== INVOICED_STATUS) {
          throw new ApiError(
            409,
            `Order #${orderId} is ${order.status.toLowerCase()}, so there is nothing to credit against it yet. Put that part against the account instead.`,
          );
        }
      }
    }

    const created: number[] = [];
    for (const allocation of data.allocations) {
      const row = await tx.supplierPayment.create({
        data: {
          supplierId,
          orderId: allocation.orderId ?? null,
          amount: allocation.amount,
          paidOn: data.paidOn,
          kind: "Credit",
          // The document number, repeated on every part of it. This is what ties
          // the rows back together as one note on the statement.
          reference: data.reference,
          notes: data.notes,
          createdBy: performedBy,
        },
        select: { paymentId: true },
      });
      created.push(row.paymentId);
    }
    return created;
  });
}
