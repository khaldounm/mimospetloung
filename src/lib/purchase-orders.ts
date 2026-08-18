import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import {
  applyStockMovementTx,
  rethrowStockMovementError,
} from "@/lib/inventory";
import { toDateOnly } from "@/utils/format";
import type { PurchaseOrderDTO, PurchaseOrderLineDTO } from "@/types/entities";
import type { PurchaseOrderStatus } from "@/types/enums";

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);

// Statuses whose lines can still be edited. A Partial order is excluded on
// purpose: part of it has already been booked into stock, so changing an ordered
// quantity or a cost after the fact would rewrite what was received.
const EDITABLE: PurchaseOrderStatus[] = ["Draft", "Placed"];

// Statuses that can still take a delivery. Partial is here because the rest of
// the order is expected to turn up later, which the clinic confirmed is normal.
const RECEIVABLE: PurchaseOrderStatus[] = ["Draft", "Placed", "Partial"];

export function isEditable(status: string): boolean {
  return EDITABLE.includes(status as PurchaseOrderStatus);
}

export function isReceivable(status: string): boolean {
  return RECEIVABLE.includes(status as PurchaseOrderStatus);
}

export const orderInclude = {
  supplier: { select: { name: true } },
  creator: { select: { firstName: true, lastName: true } },
  lines: {
    orderBy: { lineId: "asc" },
    include: {
      item: {
        select: {
          name: true,
          unit: true,
          currentStock: true,
          reorderLevel: true,
        },
      },
    },
  },
} as const;

type OrderRow = Prisma.PurchaseOrderGetPayload<{
  include: typeof orderInclude;
}>;
type LineRow = OrderRow["lines"][number];

// ---- DTO mappers ----

export function toPurchaseOrderLineDTO(l: LineRow): PurchaseOrderLineDTO {
  const lineTotal = l.unitCost
    ? l.quantityOrdered.times(l.unitCost).toDecimalPlaces(2)
    : D(0);
  // Floored at zero: a closed-short line keeps its ordered quantity, so the
  // difference stays meaningful for history without showing as still expected.
  const outstanding = l.quantityOrdered.minus(l.quantityReceived);
  return {
    lineId: l.lineId,
    orderId: l.orderId,
    itemId: l.itemId,
    itemName: l.item.name,
    unit: l.item.unit,
    currentStock: l.item.currentStock.toNumber(),
    reorderLevel: l.item.reorderLevel,
    quantityOrdered: l.quantityOrdered.toString(),
    quantityReceived: l.quantityReceived.toString(),
    quantityOutstanding: (outstanding.greaterThan(0)
      ? outstanding
      : D(0)
    ).toString(),
    unitCost: l.unitCost ? l.unitCost.toString() : null,
    lineTotal: lineTotal.toFixed(2),
    notes: l.notes,
  };
}

export function toPurchaseOrderDTO(
  o: OrderRow,
  options: { withLines?: boolean } = {},
): PurchaseOrderDTO {
  const subtotal = o.lines.reduce(
    (sum, l) =>
      l.unitCost ? sum.plus(l.quantityOrdered.times(l.unitCost)) : sum,
    D(0),
  );
  // VAT is charged on the goods after any discount, with delivery included.
  // taxAmount is stored rather than derived, so a supplier's own rounding is
  // kept once someone corrects it against the real bill.
  const taxableBase = subtotal
    .minus(o.discountAmount ?? 0)
    .plus(o.shippingAmount ?? 0);
  const total = taxableBase.plus(o.taxAmount ?? 0);

  const dto: PurchaseOrderDTO = {
    orderId: o.orderId,
    supplierId: o.supplierId,
    supplierName: o.supplier?.name ?? null,
    status: o.status as PurchaseOrderStatus,
    reference: o.reference,
    orderedOn: toDateOnly(o.orderedOn),
    receivedOn: toDateOnly(o.receivedOn),
    discountAmount: o.discountAmount ? o.discountAmount.toFixed(2) : null,
    shippingAmount: o.shippingAmount ? o.shippingAmount.toFixed(2) : null,
    taxRate: o.taxRate ? o.taxRate.toString() : null,
    taxAmount: o.taxAmount ? o.taxAmount.toFixed(2) : null,
    notes: o.notes,
    lineCount: o.lines.length,
    hasOutstanding: o.lines.some((l) =>
      l.quantityOrdered.greaterThan(l.quantityReceived),
    ),
    subtotal: subtotal.toDecimalPlaces(2).toFixed(2),
    taxableBase: taxableBase.toDecimalPlaces(2).toFixed(2),
    total: total.toDecimalPlaces(2).toFixed(2),
    createdByName: o.creator
      ? `${o.creator.firstName} ${o.creator.lastName}`
      : null,
    createdAt: o.createdAt.toISOString(),
  };
  if (options.withLines) dto.lines = o.lines.map(toPurchaseOrderLineDTO);
  return dto;
}

// ---- Reads ----

// Orders newest first. The client groups them by supplier for display; sorting
// by supplier then date here keeps that grouping stable without a second pass.
export async function getOrders(
  status?: PurchaseOrderStatus,
): Promise<PurchaseOrderDTO[]> {
  const orders = await prisma.purchaseOrder.findMany({
    where: { deletedAt: null, ...(status ? { status } : {}) },
    include: orderInclude,
    orderBy: [{ createdAt: "desc" }, { orderId: "desc" }],
  });
  return orders.map((o) => toPurchaseOrderDTO(o));
}

export async function getOrderDetail(
  orderId: number,
): Promise<PurchaseOrderDTO | null> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { orderId, deletedAt: null },
    include: orderInclude,
  });
  if (!order) return null;
  return toPurchaseOrderDTO(order, { withLines: true });
}

// ---- The future-order basket ----

export interface FutureOrderResult {
  orderId: number;
  supplierId: number | null;
  supplierName: string | null;
  itemsAdded: number;
}

// Push items into their supplier's open draft, creating that draft on first use.
// Items with no usual supplier collect in the single null-supplier draft, which
// is the "No supplier" bucket. Adding an item already on the draft bumps its
// quantity rather than duplicating the line.
//
// One transaction for the whole basket: a partial push would leave the clinic
// guessing which half of the selection actually landed.
export async function addToFutureOrder(
  lines: { itemId: number; quantity: number }[],
  performedBy: number | null,
): Promise<FutureOrderResult[]> {
  return prisma.$transaction(async (tx) => {
    // Cache the draft per supplier so a basket spanning ten items of the same
    // supplier does not race itself into ten separate drafts.
    const draftBySupplier = new Map<number | "none", number>();
    const added = new Map<number, number>();

    for (const line of lines) {
      const item = await tx.inventoryItem.findFirst({
        where: { itemId: line.itemId, deletedAt: null },
        select: { itemId: true, supplierId: true, lastCost: true },
      });
      if (!item) {
        throw new ApiError(404, `Inventory item ${line.itemId} not found`);
      }

      const key = item.supplierId ?? "none";
      let orderId = draftBySupplier.get(key);

      if (orderId === undefined) {
        const existing = await tx.purchaseOrder.findFirst({
          where: {
            deletedAt: null,
            status: "Draft",
            supplierId: item.supplierId,
          },
          orderBy: { orderId: "desc" },
          select: { orderId: true },
        });
        if (existing) {
          orderId = existing.orderId;
        } else {
          const created = await tx.purchaseOrder.create({
            data: { supplierId: item.supplierId, createdBy: performedBy },
            select: { orderId: true },
          });
          orderId = created.orderId;
        }
        draftBySupplier.set(key, orderId);
      }

      // The unique index on (order_id, item_id) makes this an upsert: a repeat
      // add increases the quantity instead of creating a second line.
      await tx.purchaseOrderLine.upsert({
        where: { orderId_itemId: { orderId, itemId: item.itemId } },
        update: { quantityOrdered: { increment: line.quantity } },
        create: {
          orderId,
          itemId: item.itemId,
          quantityOrdered: line.quantity,
          // Seed the cost from what the item last cost, so a straightforward
          // reorder needs no typing. Editable before the order is placed.
          unitCost: item.lastCost,
        },
      });
      added.set(orderId, (added.get(orderId) ?? 0) + 1);
    }

    const touched = await tx.purchaseOrder.findMany({
      where: { orderId: { in: [...added.keys()] } },
      include: { supplier: { select: { name: true } } },
    });

    return touched.map((o) => ({
      orderId: o.orderId,
      supplierId: o.supplierId,
      supplierName: o.supplier?.name ?? null,
      itemsAdded: added.get(o.orderId) ?? 0,
    }));
  });
}

// ---- Lifecycle ----

async function loadForTransition(orderId: number) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { orderId, deletedAt: null },
    include: { lines: { select: { lineId: true } } },
  });
  if (!order) throw new ApiError(404, "Purchase order not found");
  return order;
}

// Draft -> Placed. Records the date it went to the supplier.
export async function placeOrder(orderId: number, orderedOn?: Date) {
  const order = await loadForTransition(orderId);
  if (order.status !== "Draft") {
    throw new ApiError(
      409,
      `This order is already ${order.status.toLowerCase()}.`,
    );
  }
  if (order.supplierId == null) {
    throw new ApiError(
      409,
      "Assign a supplier before placing this order. Items with no usual supplier collect here until one is chosen.",
    );
  }
  if (order.lines.length === 0) {
    throw new ApiError(409, "Add at least one item before placing this order.");
  }

  return prisma.purchaseOrder.update({
    where: { orderId },
    data: { status: "Placed", orderedOn: orderedOn ?? new Date() },
  });
}

// Books in one delivery, which may be all of the order or part of it. Writes a
// Received movement per line delivered, refreshes those items' last cost, and
// lands the order in Partial or Received depending on what is still outstanding.
// All in one transaction, so a failure on the last line cannot leave half the
// delivery booked in.
//
// Callable repeatedly: the clinic confirmed short deliveries are normal and the
// remainder usually turns up later, so each arrival is its own receipt.
//
// Receiving straight from Draft is allowed. Stock often turns up before anyone
// remembers to mark the order as placed, and refusing would only teach staff to
// click through a meaningless step.
export async function receiveOrder(
  orderId: number,
  received: { lineId: number; quantity: number }[],
  performedBy: number | null,
  receivedOn?: Date,
) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { orderId, deletedAt: null },
    include: { lines: { include: { item: { select: { name: true } } } } },
  });
  if (!order) throw new ApiError(404, "Purchase order not found");
  if (!isReceivable(order.status)) {
    throw new ApiError(
      409,
      `This order is ${order.status.toLowerCase()} and can no longer take a delivery.`,
    );
  }
  if (order.lines.length === 0) {
    throw new ApiError(409, "This order has no items to receive.");
  }
  if (order.supplierId == null) {
    throw new ApiError(
      409,
      "Assign a supplier before receiving this order, so the stock is recorded against who it came from.",
    );
  }

  const byLineId = new Map(order.lines.map((l) => [l.lineId, l]));
  const deliveries: {
    line: (typeof order.lines)[number];
    quantity: Prisma.Decimal;
  }[] = [];

  for (const entry of received) {
    const line = byLineId.get(entry.lineId);
    if (!line) {
      throw new ApiError(404, `Line ${entry.lineId} is not on this order`);
    }
    const quantity = D(entry.quantity);
    if (quantity.lessThanOrEqualTo(0)) continue;

    const outstanding = line.quantityOrdered.minus(line.quantityReceived);
    if (quantity.greaterThan(outstanding)) {
      throw new ApiError(
        409,
        `Cannot receive ${quantity.toString()} of ${line.item.name}: only ${outstanding.toString()} is still outstanding.`,
      );
    }
    // Cost is what makes the delivery worth anything downstream: it becomes the
    // item's last cost, which the profit report charges as COGS when the stock
    // sells. Only the lines actually arriving need one.
    if (line.unitCost == null) {
      throw new ApiError(
        409,
        `Set a unit cost on ${line.item.name} before receiving it. It becomes the item's cost price.`,
      );
    }
    deliveries.push({ line, quantity });
  }

  if (deliveries.length === 0) {
    throw new ApiError(409, "Enter a quantity for at least one line.");
  }

  const when = receivedOn ?? new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      for (const { line, quantity } of deliveries) {
        await applyStockMovementTx(tx, {
          itemId: line.itemId,
          type: "Received",
          quantity: quantity.toNumber(),
          unitCost: line.unitCost?.toNumber(),
          referenceType: "purchase_order",
          referenceId: orderId,
          performedBy,
        });
        await tx.purchaseOrderLine.update({
          where: { lineId: line.lineId },
          data: { quantityReceived: { increment: quantity } },
        });
      }

      // Re-read rather than reasoning from the in-memory copy, so the status
      // reflects what the database actually holds after the increments.
      const after = await tx.purchaseOrderLine.findMany({
        where: { orderId },
        select: { quantityOrdered: true, quantityReceived: true },
      });
      const complete = after.every((l) =>
        l.quantityReceived.greaterThanOrEqualTo(l.quantityOrdered),
      );

      return tx.purchaseOrder.update({
        where: { orderId },
        data: {
          status: complete ? "Received" : "Partial",
          // Stamped only on the delivery that completes the order, so the
          // liability lands in the period it was actually recognised rather than
          // the period the first box arrived in.
          ...(complete ? { billedOn: when } : {}),
          // First delivery stamps the date and later ones leave it, so this
          // reads as "when stock started arriving".
          ...(order.receivedOn ? {} : { receivedOn: when }),
          // Backfill the ordered date when receiving straight from Draft, so
          // every delivered order carries both dates.
          ...(order.orderedOn ? {} : { orderedOn: when }),
        },
      });
    });
  } catch (err) {
    rethrowStockMovementError(err);
  }
}

// Partial -> Received, for the delivery that is never going to be completed.
// Leaves the ordered quantities alone so the shortfall stays visible, and books
// in no stock, since nothing more arrived. Without this an order the supplier
// short-shipped for good would sit outstanding forever.
export async function closeShort(orderId: number, closedOn?: Date) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { orderId, deletedAt: null },
    select: { orderId: true, status: true },
  });
  if (!order) throw new ApiError(404, "Purchase order not found");
  if (order.status !== "Partial") {
    throw new ApiError(
      409,
      "Only a part-delivered order can be closed short. Cancel it instead if nothing has arrived.",
    );
  }
  return prisma.purchaseOrder.update({
    where: { orderId },
    // Closing short is the moment the liability is settled at what arrived, so
    // it recognises the bill just as a final delivery would.
    data: { status: "Received", billedOn: closedOn ?? new Date() },
  });
}

// Draft or Placed -> Cancelled. Never touches stock, so it is safe at any point
// before the delivery is booked in. A Partial order is deliberately excluded:
// stock from it is already on the shelf, so it is closed short instead.
export async function cancelOrder(orderId: number) {
  const order = await loadForTransition(orderId);
  if (!isEditable(order.status)) {
    throw new ApiError(
      409,
      `This order is already ${order.status.toLowerCase()}.`,
    );
  }
  return prisma.purchaseOrder.update({
    where: { orderId },
    data: { status: "Cancelled" },
  });
}
