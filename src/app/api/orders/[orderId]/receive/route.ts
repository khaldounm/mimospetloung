import { NextResponse } from "next/server";
import { handle, parseBody, parseId, requirePermission } from "@/lib/api";
import { getOrderDetail, receiveOrder } from "@/lib/purchase-orders";
import { writeAudit } from "@/lib/audit";
import { receiveOrderSchema } from "@/schemas/purchase-order";

// Books in one delivery, whole or partial. Callable repeatedly as the rest of
// the order turns up. Requires inventory:write as well as orders:write, because
// it moves stock.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    await requirePermission("inventory:write");
    const session = await requirePermission("orders:write");
    const orderId = parseId((await params).orderId, "order id");
    const data = await parseBody(request, receiveOrderSchema);

    const order = await receiveOrder(
      orderId,
      data.lines,
      session.user.userId,
      data.receivedOn,
    );
    await writeAudit(session, {
      action: "stock",
      entity: "purchase_order",
      entityId: orderId,
      changes: {
        status: order.status,
        receivedOn: order.receivedOn,
        lines: data.lines.filter((l) => l.quantity > 0),
      },
    });
    return NextResponse.json({ order: await getOrderDetail(orderId) });
  });
}
