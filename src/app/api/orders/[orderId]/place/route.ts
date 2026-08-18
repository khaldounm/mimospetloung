import { NextResponse } from "next/server";
import { handle, parseId, requirePermission } from "@/lib/api";
import { getOrderDetail, placeOrder } from "@/lib/purchase-orders";
import { writeAudit } from "@/lib/audit";

// Draft -> Placed. Records the date the order went to the supplier.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const orderId = parseId((await params).orderId, "order id");

    const order = await placeOrder(orderId);
    await writeAudit(session, {
      action: "update",
      entity: "purchase_order",
      entityId: orderId,
      changes: { status: "Placed", orderedOn: order.orderedOn },
    });
    return NextResponse.json({ order: await getOrderDetail(orderId) });
  });
}
