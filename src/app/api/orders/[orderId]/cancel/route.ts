import { NextResponse } from "next/server";
import { handle, parseId, requirePermission } from "@/lib/api";
import { cancelOrder, getOrderDetail } from "@/lib/purchase-orders";
import { writeAudit } from "@/lib/audit";

// Draft or Placed -> Cancelled. Never touches stock, so it is safe right up
// until the delivery is booked in.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const orderId = parseId((await params).orderId, "order id");

    await cancelOrder(orderId);
    await writeAudit(session, {
      action: "cancel",
      entity: "purchase_order",
      entityId: orderId,
      changes: { status: "Cancelled" },
    });
    return NextResponse.json({ order: await getOrderDetail(orderId) });
  });
}
