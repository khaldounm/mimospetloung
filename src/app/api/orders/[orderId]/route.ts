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
  orderInclude,
  toPurchaseOrderDTO,
} from "@/lib/purchase-orders";
import { writeAudit } from "@/lib/audit";
import { purchaseOrderUpdateSchema } from "@/schemas/purchase-order";

async function getOrderId(params: Promise<{ orderId: string }>) {
  return parseId((await params).orderId, "order id");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    await requirePermission("orders:read");
    const orderId = await getOrderId(params);

    const order = await getOrderDetail(orderId);
    if (!order) throw new ApiError(404, "Purchase order not found");

    return NextResponse.json({ order });
  });
}

// Header edits only. Status changes go through the place / receive / cancel
// routes so their side effects can never be bypassed with a plain PATCH.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const orderId = await getOrderId(params);
    const data = await parseBody(request, purchaseOrderUpdateSchema);

    const existing = await prisma.purchaseOrder.findFirst({
      where: { orderId, deletedAt: null },
      select: { orderId: true, status: true },
    });
    if (!existing) throw new ApiError(404, "Purchase order not found");
    if (!isEditable(existing.status)) {
      throw new ApiError(
        409,
        `This order is ${existing.status.toLowerCase()} and can no longer be edited.`,
      );
    }

    const order = await prisma.purchaseOrder.update({
      where: { orderId },
      data: {
        ...(data.supplierId !== undefined
          ? { supplierId: data.supplierId }
          : {}),
        ...(data.reference !== undefined ? { reference: data.reference } : {}),
        ...(data.orderedOn !== undefined ? { orderedOn: data.orderedOn } : {}),
        ...(data.discountAmount !== undefined
          ? { discountAmount: data.discountAmount }
          : {}),
        ...(data.shippingAmount !== undefined
          ? { shippingAmount: data.shippingAmount }
          : {}),
        ...(data.taxRate !== undefined ? { taxRate: data.taxRate } : {}),
        ...(data.taxAmount !== undefined ? { taxAmount: data.taxAmount } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: orderInclude,
    });
    await writeAudit(session, {
      action: "update",
      entity: "purchase_order",
      entityId: orderId,
      changes: data,
    });
    return NextResponse.json({
      order: toPurchaseOrderDTO(order, { withLines: true }),
    });
  });
}

// Soft delete, for a draft raised by mistake. A placed or received order is
// cancelled instead, which keeps it visible in the history.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const orderId = await getOrderId(params);

    const existing = await prisma.purchaseOrder.findFirst({
      where: { orderId, deletedAt: null },
      select: { orderId: true, status: true },
    });
    if (!existing) throw new ApiError(404, "Purchase order not found");
    if (existing.status !== "Draft") {
      throw new ApiError(
        409,
        `Only a draft can be deleted. Cancel this ${existing.status.toLowerCase()} order instead, so it stays on record.`,
      );
    }

    await prisma.purchaseOrder.update({
      where: { orderId },
      data: { deletedAt: new Date() },
    });
    await writeAudit(session, {
      action: "delete",
      entity: "purchase_order",
      entityId: orderId,
      changes: { softDelete: true },
    });
    return NextResponse.json({ ok: true });
  });
}
