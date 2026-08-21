import { NextResponse } from "next/server";
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
  isEditable,
  resolvePurchaseLine,
} from "@/lib/purchase-orders";
import { writeAudit } from "@/lib/audit";
import { purchaseOrderLineCreateSchema } from "@/schemas/purchase-order";

// Adds one item to an existing order. The line's cost defaults to what the item
// last cost, matching how the low-stock basket seeds it.
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
    if (!isEditable(order.status)) {
      throw new ApiError(
        409,
        `This order is ${order.status.toLowerCase()} and can no longer be edited.`,
      );
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { itemId: data.itemId, deletedAt: null },
      select: {
        itemId: true,
        lastCost: true,
        looseUnit: true,
        loosePerUnit: true,
        loosePrice: true,
      },
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
        addedItem: data.itemId,
        quantity: resolved.quantity,
        ...(resolved.looseQty != null
          ? { looseQty: resolved.looseQty, looseUnit: resolved.looseUnit }
          : {}),
      },
    });
    return NextResponse.json({ order: await getOrderDetail(orderId) });
  });
}
