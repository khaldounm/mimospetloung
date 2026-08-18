import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  handle,
  parseBody,
  parseId,
  requirePermission,
} from "@/lib/api";
import { getOrderDetail, isEditable } from "@/lib/purchase-orders";
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
      select: { itemId: true, lastCost: true },
    });
    if (!item) throw new ApiError(404, "Inventory item not found");

    // Adding an item already on the order bumps its quantity, matching the
    // basket. Two lines for one item would only split the delivery in half.
    await prisma.purchaseOrderLine.upsert({
      where: { orderId_itemId: { orderId, itemId: item.itemId } },
      update: { quantityOrdered: { increment: data.quantityOrdered } },
      create: {
        orderId,
        itemId: item.itemId,
        quantityOrdered: data.quantityOrdered,
        unitCost: data.unitCost ?? item.lastCost,
        notes: data.notes,
      },
    });

    await writeAudit(session, {
      action: "update",
      entity: "purchase_order",
      entityId: orderId,
      changes: { addedItem: data.itemId, quantity: data.quantityOrdered },
    });
    return NextResponse.json({ order: await getOrderDetail(orderId) });
  });
}
