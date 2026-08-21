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
  resolvePurchaseLine,
} from "@/lib/purchase-orders";
import { writeAudit } from "@/lib/audit";
import { purchaseOrderLineUpdateSchema } from "@/schemas/purchase-order";

type Params = { params: Promise<{ orderId: string; lineId: string }> };

// Loads the line and asserts it belongs to an order that is still editable.
async function loadEditableLine(params: Params["params"]) {
  const { orderId: rawOrder, lineId: rawLine } = await params;
  const orderId = parseId(rawOrder, "order id");
  const lineId = parseId(rawLine, "line id");

  const line = await prisma.purchaseOrderLine.findFirst({
    where: { lineId, orderId },
    include: {
      order: { select: { status: true, deletedAt: true } },
      item: {
        select: { looseUnit: true, loosePerUnit: true, loosePrice: true },
      },
    },
  });
  if (!line || line.order.deletedAt) {
    throw new ApiError(404, "Order line not found");
  }
  if (!isEditable(line.order.status)) {
    throw new ApiError(
      409,
      `This order is ${line.order.status.toLowerCase()} and can no longer be edited.`,
    );
  }
  return { orderId, lineId, item: line.item };
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const { orderId, lineId, item } = await loadEditableLine(params);
    const data = await parseBody(request, purchaseOrderLineUpdateSchema);

    // Editing in loose units re-derives the ordered quantity and the per-pack
    // cost together, so a per-kilo price can never be left sitting on a line
    // measured in bags.
    const resolved =
      data.looseQty !== undefined
        ? resolvePurchaseLine(item, {
            looseQty: data.looseQty,
            unitCost: data.unitCost,
          })
        : null;

    await prisma.purchaseOrderLine.update({
      where: { lineId },
      data: {
        ...(resolved
          ? {
              quantityOrdered: resolved.quantity,
              looseQty: resolved.looseQty,
              looseUnit: resolved.looseUnit,
              ...(resolved.unitCost !== undefined
                ? { unitCost: resolved.unitCost }
                : {}),
            }
          : {
              ...(data.quantityOrdered !== undefined
                ? {
                    quantityOrdered: data.quantityOrdered,
                    // Switching back to packs drops a stale loose record.
                    looseQty: null,
                    looseUnit: null,
                  }
                : {}),
              ...(data.unitCost !== undefined
                ? { unitCost: data.unitCost }
                : {}),
            }),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });

    await writeAudit(session, {
      action: "update",
      entity: "purchase_order_line",
      entityId: lineId,
      changes: data,
    });
    return NextResponse.json({ order: await getOrderDetail(orderId) });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const { orderId, lineId } = await loadEditableLine(params);

    // Hard delete: a line removed before the order is placed was never real,
    // and the audit entry is the record that it was considered.
    await prisma.purchaseOrderLine.delete({ where: { lineId } });

    await writeAudit(session, {
      action: "delete",
      entity: "purchase_order_line",
      entityId: lineId,
      changes: { orderId },
    });
    return NextResponse.json({ order: await getOrderDetail(orderId) });
  });
}
