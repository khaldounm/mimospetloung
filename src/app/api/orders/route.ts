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
import type { OrderStatusFilter } from "@/constants/order";
import type { PurchaseOrderStatus } from "@/types/enums";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("orders:read");

    const sp = new URL(request.url).searchParams;
    const raw = sp.get("status")?.trim();
    // "Open" is the working view rather than a stored status, so it is allowed
    // through alongside the real ones.
    const status =
      raw === "Open" ||
      PURCHASE_ORDER_STATUSES.includes(raw as PurchaseOrderStatus)
        ? (raw as OrderStatusFilter)
        : undefined;
    const pageRaw = sp.get("page")?.trim();

    const page = await getOrders({
      status,
      page: pageRaw ? Number(pageRaw) : 1,
    });
    return NextResponse.json(page);
  });
}

// Creates an empty order by hand, for stock the basket cannot reach: a one-off
// buy, or items the catalogue does not have yet. The other route in is the
// low-stock basket (POST /api/orders/add-items), which creates drafts on demand
// per supplier and shelf.
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const data = await parseBody(request, purchaseOrderCreateSchema);

    const order = await prisma.purchaseOrder.create({
      data: {
        supplierId: data.supplierId ?? null,
        category: data.category ?? null,
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
