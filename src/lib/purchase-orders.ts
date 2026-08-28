import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { DEFAULT_DISCOUNT_UNIT, type DiscountUnit } from "@/constants/order";
import { netUnitCost } from "@/utils/discount";
import {
  applyStockMovementTx,
  rethrowStockMovementError,
} from "@/lib/inventory";
import { toDateOnly } from "@/utils/format";
import {
  looseConfigOf,
  looseToPacks,
  minLooseQuantity,
  roundMoney,
} from "@/utils/inventory";
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
          // Which shelf the item belongs to, matched against a supplier
          // contact's categories so a send picks the right rep.
          category: true,
          currentStock: true,
          reorderLevel: true,
          // So the receive dialog knows which lines want a lot and expiry, and
          // which line a scanned carton belongs to.
          tracksExpiry: true,
          barcode: true,
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
  // How much of this line has still to move, as a MAGNITUDE. On a return line
  // ordered is negative and so is the difference, and reporting that verbatim
  // would have the receive dialog filter the line out entirely (it keeps lines
  // with outstanding > 0), leaving a return document impossible to send.
  //
  // A magnitude is also what the dialog wants either way: whoever is at the
  // shelf types how many moved, and the direction comes off the line on the
  // server. Floored at zero because a closed-short line keeps its ordered
  // quantity, so the difference stays meaningful for history without showing as
  // still expected.
  const outstanding = l.quantityOrdered.minus(l.quantityReceived).abs();
  return {
    lineId: l.lineId,
    orderId: l.orderId,
    itemId: l.itemId,
    itemName: l.item.name,
    category: l.item.category,
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
    looseQty: l.looseQty ? l.looseQty.toString() : null,
    looseUnit: l.looseUnit,
    tracksExpiry: l.item.tracksExpiry,
    barcode: l.item.barcode,
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
    category: o.category,
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
    // Magnitudes again: `ordered > received` is false for every return line
    // (-4 > 0), which would hide the Receive action on a return document and
    // strand it in Draft forever.
    hasOutstanding: o.lines.some((l) =>
      l.quantityOrdered.abs().greaterThan(l.quantityReceived.abs()),
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
  category: string | null;
  itemsAdded: number;
}

// Which open draft an item belongs in: its usual supplier AND its shelf. The
// clinic buys each product line from a different rep at the same company (see
// SupplierContact.categories), so food and medication from one supplier are two
// conversations and two sheets. Keying on supplier alone, as this used to,
// dropped both onto whichever draft happened to be open.
//
// Both halves can be null. An item with no usual supplier collects in the "No
// supplier" bucket as before; an uncategorised item collects in its supplier's
// uncategorised draft rather than being forced onto a shelf it does not belong
// to.
function draftBucketKey(
  supplierId: number | null,
  category: string | null,
): string {
  return `${supplierId ?? "none"}::${category ?? "none"}`;
}

// Push items into the open draft for their supplier and shelf, creating that
// draft on first use. Adding an item already on the draft bumps its quantity
// rather than duplicating the line.
//
// One transaction for the whole basket: a partial push would leave the clinic
// guessing which half of the selection actually landed.
export async function addToFutureOrder(
  lines: { itemId: number; quantity: number }[],
  performedBy: number | null,
): Promise<FutureOrderResult[]> {
  return prisma.$transaction(async (tx) => {
    // Cache the draft per bucket so a basket spanning ten items of the same
    // supplier and shelf does not race itself into ten separate drafts.
    const draftByBucket = new Map<string, number>();
    const added = new Map<number, number>();

    for (const line of lines) {
      const item = await tx.inventoryItem.findFirst({
        where: { itemId: line.itemId, deletedAt: null },
        select: {
          itemId: true,
          supplierId: true,
          category: true,
          lastCost: true,
        },
      });
      if (!item) {
        throw new ApiError(404, `Inventory item ${line.itemId} not found`);
      }

      // An empty category string is the same absence as null; normalising here
      // keeps one bucket for both rather than two that look identical on screen.
      const category = item.category?.trim() ? item.category : null;
      const key = draftBucketKey(item.supplierId, category);
      let orderId = draftByBucket.get(key);

      if (orderId === undefined) {
        const existing = await tx.purchaseOrder.findFirst({
          where: {
            deletedAt: null,
            status: "Draft",
            supplierId: item.supplierId,
            category,
          },
          orderBy: { orderId: "desc" },
          select: { orderId: true },
        });
        if (existing) {
          orderId = existing.orderId;
        } else {
          const created = await tx.purchaseOrder.create({
            data: {
              supplierId: item.supplierId,
              category,
              createdBy: performedBy,
            },
            select: { orderId: true },
          });
          orderId = created.orderId;
        }
        draftByBucket.set(key, orderId);
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
      category: o.category,
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

// ---- Loose purchase lines ----

export interface LooseCapableItem {
  looseUnit: string | null;
  loosePerUnit: Prisma.Decimal | null;
  loosePrice: Prisma.Decimal | null;
}

export interface ResolvedPurchaseLine {
  quantity: number;
  unitCost: number | undefined;
  looseQty: number | null;
  looseUnit: string | null;
}

/**
 * Turn a purchase line keyed in loose units into what the line stores.
 *
 * Suppliers quote a 20kg sack either way, "$35 a bag" or "$1.75 a kilo", so
 * both the ordering and the receiving end accept either. The conversion runs
 * here, on the server and before any validation, because the outstanding check
 * compares a delivery straight against quantityOrdered and the two have to be
 * in the same unit by then.
 *
 * Cost converts, and it converts PRO RATA, which is the opposite of the selling
 * side. A sale price for loose stock is an independent markup; a purchase cost
 * genuinely is the pack cost divided, so $1.75/kg on a 20kg bag is $35.00 a
 * bag. Accepting a kilo quantity while leaving a per-kilo cost would land the
 * item's lastCost twenty times low and quietly poison margin and every future
 * partner payout.
 */
export function resolvePurchaseLine(
  item: LooseCapableItem | null,
  input: { quantity?: number; looseQty?: number; unitCost?: number },
): ResolvedPurchaseLine {
  if (input.looseQty === undefined) {
    if (input.quantity === undefined) {
      throw new ApiError(400, "A quantity is required");
    }
    return {
      quantity: input.quantity,
      unitCost: input.unitCost,
      looseQty: null,
      looseUnit: null,
    };
  }

  const config = item ? looseConfigOf(item) : null;
  if (!config) {
    throw new ApiError(
      400,
      "This item is not set up to be bought or sold loose. Set its loose unit, pack size and loose price first.",
    );
  }

  const quantity = looseToPacks(input.looseQty, config);
  if (quantity == null) {
    throw new ApiError(
      400,
      `The smallest amount that can be ordered loose is ${minLooseQuantity(config)} ${config.unit}.`,
    );
  }

  return {
    quantity,
    unitCost:
      input.unitCost !== undefined
        ? roundMoney(input.unitCost * config.perUnit)
        : undefined,
    looseQty: input.looseQty,
    looseUnit: config.unit,
  };
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
//
// Each line may carry the cost the supplier actually invoiced. An order is
// raised from the item's last known cost, which is an estimate: the real figure
// only arrives with the delivery note. Without a way to correct it here the
// estimate was booked as fact and then written back as the item's last cost,
// seeding the next order with the same stale number, and the supplier balance
// (built from quantityOrdered * unitCost) was billed at a guess.
// The Received movement that brought a delivery line's stock in, found through
// the batch that delivery opened.
//
// Movements record the order, not the line, so the batch is the only thing that
// remembers which line a particular lot came from (it carries purchaseLineId).
// Untracked items have no batches and get null, which is right: with no lots
// there is nothing to send back "from", and ordinary picking is correct.
async function originReceiptMovement(
  tx: Prisma.TransactionClient,
  purchaseLineId: number,
): Promise<number | null> {
  const batch = await tx.inventoryBatch.findFirst({
    where: { purchaseLineId },
    select: { batchId: true },
  });
  if (!batch) return null;
  const movement = await tx.inventoryBatchMovement.findFirst({
    where: { batchId: batch.batchId, quantity: { gt: 0 } },
    orderBy: { id: "asc" },
    select: { transactionId: true },
  });
  return movement?.transactionId ?? null;
}

export async function receiveOrder(
  orderId: number,
  received: {
    lineId: number;
    quantity: number;
    unitCost?: number;
    // A trade discount off the invoiced cost. Applied here rather than carried
    // any further: what the rest of the system sees is the net cost.
    discount?: number;
    discountUnit?: DiscountUnit;
    looseQty?: number;
    // Off the carton, for perishables. One GS1 DataMatrix scan fills both.
    lotNumber?: string | null;
    expiryDate?: Date | null;
  }[],
  performedBy: number | null,
  receivedOn?: Date,
) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { orderId, deletedAt: null },
    include: {
      lines: {
        include: {
          item: {
            select: {
              name: true,
              looseUnit: true,
              loosePerUnit: true,
              loosePrice: true,
            },
          },
        },
      },
    },
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
    // True when this line is stock going BACK to the supplier.
    outgoing: boolean;
    // What this delivery cost, frozen onto its own movement.
    unitCost: Prisma.Decimal;
    // What the line should now read, blended across every delivery so far.
    lineCost: Prisma.Decimal;
    // Batch details for a perishable delivery. Ignored on untracked items.
    lotNumber?: string | null;
    expiryDate?: Date | null;
  }[] = [];

  for (const entry of received) {
    const line = byLineId.get(entry.lineId);
    if (!line) {
      throw new ApiError(404, `Line ${entry.lineId} is not on this order`);
    }
    // A delivery note written in kilos becomes bags here, before the
    // outstanding check below compares it against the ordered quantity. Both
    // have to be in the stocking unit by that point or the comparison is
    // meaningless. The per-kilo cost converts to a per-bag cost with it.
    // The discount comes off before the loose conversion, so a rate quoted per
    // kilo discounts per kilo and then multiplies up by the pack size. Doing it
    // after would apply a per-kilo amount to a per-bag cost.
    const invoiced = entry.unitCost;
    const discounted =
      invoiced !== undefined
        ? netUnitCost(
            invoiced,
            entry.discount,
            entry.discountUnit ?? DEFAULT_DISCOUNT_UNIT,
          )
        : undefined;
    const resolved = resolvePurchaseLine(line.item, {
      quantity: entry.quantity,
      looseQty: entry.looseQty,
      unitCost: discounted,
    });

    // Always a magnitude. Which way the stock moves is a property of the LINE:
    // a negative quantityOrdered is stock going back to the supplier, the
    // convention the ledger has used since supplier returns landed. This used to
    // read `<= 0 continue`, which silently skipped every return line and made
    // one impossible to book.
    const quantity = D(resolved.quantity).abs();
    if (quantity.isZero()) continue;
    const outgoing = line.quantityOrdered.isNegative();

    // Compared as magnitudes, or a return line (ordered -2, received 0) reads as
    // having nothing outstanding and refuses the very delivery it exists for.
    const outstanding = line.quantityOrdered.minus(line.quantityReceived).abs();
    if (quantity.greaterThan(outstanding)) {
      throw new ApiError(
        409,
        outgoing
          ? `Cannot send back ${quantity.toString()} of ${line.item.name}: only ${outstanding.toString()} is still to go back.`
          : `Cannot receive ${quantity.toString()} of ${line.item.name}: only ${outstanding.toString()} is still outstanding.`,
      );
    }
    // Cost is what makes the delivery worth anything downstream: it becomes the
    // item's last cost, which the profit report charges as COGS when the stock
    // sells. Only the lines actually arriving need one. The dialog pre-fills
    // the line's figure, so leaving it alone behaves exactly as before.
    const unitCost =
      resolved.unitCost !== undefined ? D(resolved.unitCost) : line.unitCost;
    if (unitCost == null) {
      throw new ApiError(
        409,
        `Enter a unit cost for ${line.item.name}. It becomes the item's cost price and is what the profit report charges when that stock sells.`,
      );
    }

    // A part-delivered line can arrive at two different prices, and the line
    // holds only one. Weighting what is already in against what is arriving
    // keeps quantityOrdered * unitCost equal to what was actually paid, which
    // is what both the order total and the supplier balance are built from.
    // Letting the newest price simply overwrite would retroactively reprice a
    // delivery that settled months ago. The per-delivery cost is frozen on its
    // own movement, so COGS and margin are untouched by this blend.
    const alreadyIn = line.quantityReceived.abs();
    const lineCost =
      alreadyIn.greaterThan(0) && line.unitCost != null
        ? alreadyIn
            .times(line.unitCost)
            .plus(quantity.times(unitCost))
            .dividedBy(alreadyIn.plus(quantity))
            .toDecimalPlaces(2)
        : unitCost;

    deliveries.push({
      line,
      quantity,
      outgoing,
      unitCost,
      lineCost,
      lotNumber: entry.lotNumber,
      expiryDate: entry.expiryDate,
    });
  }

  if (deliveries.length === 0) {
    throw new ApiError(409, "Enter a quantity for at least one line.");
  }

  const when = receivedOn ?? new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      for (const {
        line,
        quantity,
        outgoing,
        unitCost,
        lineCost,
        lotNumber,
        expiryDate,
      } of deliveries) {
        // Goods going back leave by the lot they arrived in where that can be
        // worked out, rather than by FEFO. FEFO is usually wrong here: what goes
        // back to the supplier is the short-dated or damaged carton, not the
        // oldest one on the shelf. Only an exact undo qualifies, so a part
        // return falls back to the ordinary picking rules.
        const reverseOf =
          outgoing && line.returnedFromLineId != null
            ? await originReceiptMovement(tx, line.returnedFromLineId)
            : null;

        // The movement takes this delivery's own cost, which also refreshes the
        // item's last cost. That is deliberately the newest real price rather
        // than the blend below: last cost means "what it cost most recently",
        // and it is what seeds the next reorder. A return does NOT refresh it,
        // because applyStockMovementTx only does that for Received: sending
        // stock back is not a purchase and must not reprice the item.
        await applyStockMovementTx(tx, {
          itemId: line.itemId,
          type: outgoing ? "ReturnedToSupplier" : "Received",
          quantity: quantity.toNumber(),
          unitCost: unitCost.toNumber(),
          referenceType: "purchase_order",
          referenceId: orderId,
          performedBy,
          // Opens a batch for a perishable item, so this delivery's expiry is
          // tracked separately from whatever is already on the shelf.
          lotNumber,
          expiryDate,
          purchaseLineId: line.lineId,
          reverseOf,
        });
        await tx.purchaseOrderLine.update({
          where: { lineId: line.lineId },
          data: {
            // Received shares the sign of ordered, which the
            // po_lines_received_within_ordered constraint enforces.
            quantityReceived: {
              increment: outgoing ? quantity.negated() : quantity,
            },
            unitCost: lineCost,
          },
        });
      }

      // Re-read rather than reasoning from the in-memory copy, so the status
      // reflects what the database actually holds after the increments.
      const after = await tx.purchaseOrderLine.findMany({
        where: { orderId },
        select: { quantityOrdered: true, quantityReceived: true },
      });
      // Magnitudes, or a return line is complete before anything has gone back:
      // ordered -2 with received 0 satisfies `0 >= -2` and would flip the whole
      // document to Received the moment the line was added.
      const complete = after.every((l) =>
        l.quantityReceived.abs().greaterThanOrEqualTo(l.quantityOrdered.abs()),
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
