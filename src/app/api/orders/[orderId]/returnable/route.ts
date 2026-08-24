import { NextResponse } from "next/server";
import { handle, parseId, requirePermission } from "@/lib/api";
import { listReturnableDeliveries } from "@/lib/returns";

// What is still sendable back on a delivered order: each line, how much of it
// has already gone, and what it cost.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    await requirePermission("orders:read");
    const orderId = parseId((await params).orderId, "order id");
    return NextResponse.json({
      order: await listReturnableDeliveries(orderId),
    });
  });
}
