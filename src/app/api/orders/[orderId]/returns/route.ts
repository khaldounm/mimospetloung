import { NextResponse } from "next/server";
import { handle, parseBody, parseId, requirePermission } from "@/lib/api";
import { getOrderDetail } from "@/lib/purchase-orders";
import { createSupplierReturn } from "@/lib/returns";
import { supplierReturnCreateSchema } from "@/schemas/purchase-order";
import { writeAudit } from "@/lib/audit";

// Raise a return document against this delivered order. It moves no stock on
// its own: the goods leave when the return is received, the same way a delivery
// arrives, so this needs orders:write but not inventory:write.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const orderId = parseId((await params).orderId, "order id");
    const data = await parseBody(request, supplierReturnCreateSchema);

    const order = await createSupplierReturn(
      orderId,
      data.entries,
      session.user.userId,
    );

    await writeAudit(session, {
      action: "return",
      entity: "purchase_order",
      entityId: order.orderId,
      changes: { againstOrderId: orderId, entries: data.entries },
    });

    return NextResponse.json(
      { order: await getOrderDetail(order.orderId) },
      { status: 201 },
    );
  });
}
