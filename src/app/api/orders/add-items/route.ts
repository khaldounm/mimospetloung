import { NextResponse } from "next/server";
import { handle, parseBody, requirePermission } from "@/lib/api";
import { addToFutureOrder } from "@/lib/purchase-orders";
import { writeAudit } from "@/lib/audit";
import { addToFutureOrderSchema } from "@/schemas/purchase-order";

// Pushes a selection of inventory items into their supplier's open draft. The
// client sends items and quantities only: which order each one lands in is
// decided server-side from the item's usual supplier, so the two can never
// disagree.
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const data = await parseBody(request, addToFutureOrderSchema);

    const results = await addToFutureOrder(data.lines, session.user.userId);

    // One audit entry per order touched, so an order's history shows every
    // basket push that fed it.
    for (const result of results) {
      await writeAudit(session, {
        action: "update",
        entity: "purchase_order",
        entityId: result.orderId,
        changes: { addedToFutureOrder: result.itemsAdded },
      });
    }

    return NextResponse.json({ orders: results });
  });
}
