import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, parseBody, requirePermission } from "@/lib/api";
import {
  getOrders,
  orderInclude,
  toPurchaseOrderDTO,
} from "@/lib/purchase-orders";
import { writeAudit } from "@/lib/audit";
import { purchaseOrderCreateSchema } from "@/schemas/purchase-order";
import { PURCHASE_ORDER_STATUSES } from "@/types/enums";
import type { PurchaseOrderStatus } from "@/types/enums";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("orders:read");

    const raw = new URL(request.url).searchParams.get("status")?.trim();
    const status = PURCHASE_ORDER_STATUSES.includes(raw as PurchaseOrderStatus)
      ? (raw as PurchaseOrderStatus)
      : undefined;

    const orders = await getOrders(status);
    return NextResponse.json({ orders });
  });
}

// Creates an empty order by hand. The usual route into an order is the low-stock
// basket (POST /api/orders/add-items), which creates drafts on demand.
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const data = await parseBody(request, purchaseOrderCreateSchema);

    const order = await prisma.purchaseOrder.create({
      data: {
        supplierId: data.supplierId ?? null,
        reference: data.reference,
        notes: data.notes,
        createdBy: session.user.userId,
      },
      include: orderInclude,
    });
    await writeAudit(session, {
      action: "create",
      entity: "purchase_order",
      entityId: order.orderId,
      changes: data,
    });
    return NextResponse.json(
      { order: toPurchaseOrderDTO(order, { withLines: true }) },
      { status: 201 },
    );
  });
}
