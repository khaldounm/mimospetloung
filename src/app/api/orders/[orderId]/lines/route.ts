import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  handle,
  parseBody,
  parseId,
  requirePermission,
} from "@/lib/api";
import {
  getOrderDetail,
  isReceivable,
  resolvePurchaseLine,
} from "@/lib/purchase-orders";
import { writeAudit } from "@/lib/audit";
import { purchaseOrderLineCreateSchema } from "@/schemas/purchase-order";

// Everything a line needs off the item: what it last cost, and how it is sold
// loose so a quantity keyed in kilos can be converted to packs.
const lineItemSelect = {
  itemId: true,
  lastCost: true,
  looseUnit: true,
  loosePerUnit: true,
  loosePrice: true,
} satisfies Prisma.InventoryItemSelect;

type PurchaseLineItem = Prisma.InventoryItemGetPayload<{
  select: typeof lineItemSelect;
}>;

// Adds one item to an existing order. The line's cost defaults to what the item
// last cost, matching how the low-stock basket seeds it.
//
// Items are only ever referenced here, never created: a product that arrived
// without being ordered is keyed into the ordinary item form first (which is
// what gives it a partner, its expiry handling and how it sells loose), and
// lands here by id like anything else.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const orderId = parseId((await params).orderId, "order id");
    const data = await parseBody(request, purchaseOrderLineCreateSchema);

    const order = await prisma.purchaseOrder.findFirst({
      where: { orderId, deletedAt: null },
      select: { orderId: true, status: true },
    });
    if (!order) throw new ApiError(404, "Purchase order not found");
    // Receivable rather than editable: adding a line neither rewrites a
    // delivered quantity nor a booked cost, which is what the stricter rule on
    // line EDITS exists to protect. A second delivery that brings something new
    // has to be bookable against the order it arrived on.
    if (!isReceivable(order.status)) {
      throw new ApiError(
        409,
        `This order is ${order.status.toLowerCase()} and can no longer take lines.`,
      );
    }

    const item: PurchaseLineItem | null = await prisma.inventoryItem.findFirst({
      where: { itemId: data.itemId, deletedAt: null },
      select: lineItemSelect,
    });
    if (!item) throw new ApiError(404, "Inventory item not found");

    // A line keyed in kilos becomes bags here, and a per-kilo cost becomes a
    // per-bag cost with it.
    const resolved = resolvePurchaseLine(item, {
      quantity: data.quantityOrdered,
      looseQty: data.looseQty,
      unitCost: data.unitCost,
    });

    // Adding an item already on the order bumps its quantity, matching the
    // basket. Two lines for one item would only split the delivery in half.
    await prisma.purchaseOrderLine.upsert({
      where: { orderId_itemId: { orderId, itemId: item.itemId } },
      update: {
        quantityOrdered: { increment: resolved.quantity },
        // The loose record describes this addition, so a repeat add in the same
        // unit keeps it and one in packs clears it rather than lying.
        looseQty: resolved.looseQty,
        looseUnit: resolved.looseUnit,
      },
      create: {
        orderId,
        itemId: item.itemId,
        quantityOrdered: resolved.quantity,
        unitCost: resolved.unitCost ?? item.lastCost,
        looseQty: resolved.looseQty,
        looseUnit: resolved.looseUnit,
        notes: data.notes,
      },
    });

    await writeAudit(session, {
      action: "update",
      entity: "purchase_order",
      entityId: orderId,
      changes: {
        addedItem: item.itemId,
        quantity: resolved.quantity,
        ...(resolved.looseQty != null
          ? { looseQty: resolved.looseQty, looseUnit: resolved.looseUnit }
          : {}),
      },
    });
    return NextResponse.json({ order: await getOrderDetail(orderId) });
  });
}
