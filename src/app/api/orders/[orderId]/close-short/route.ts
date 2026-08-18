import { NextResponse } from "next/server";
import { handle, parseId, requirePermission } from "@/lib/api";
import { closeShort, getOrderDetail } from "@/lib/purchase-orders";
import { writeAudit } from "@/lib/audit";

// Settles a part-delivered order whose remainder is never coming. Books in no
// stock and leaves the ordered quantities alone, so the shortfall stays on
// record instead of the order sitting outstanding forever.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const orderId = parseId((await params).orderId, "order id");

    await closeShort(orderId);
    await writeAudit(session, {
      action: "update",
      entity: "purchase_order",
      entityId: orderId,
      changes: { status: "Received", closedShort: true },
    });
    return NextResponse.json({ order: await getOrderDetail(orderId) });
  });
}
