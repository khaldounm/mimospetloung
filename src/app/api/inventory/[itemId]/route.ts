import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import {
  isUniqueConstraintError,
  toInventoryItemDTO,
  toInventoryTransactionDTO,
} from "@/lib/inventory";
import { writeAudit } from "@/lib/audit";
import { inventoryItemUpdateSchema } from "@/schemas/inventory";

async function getItemId(params: Promise<{ itemId: string }>) {
  const { itemId } = await params;
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  return handle(async () => {
    await requirePermission("inventory:read");
    const itemId = await getItemId(params);

    const item = await prisma.inventoryItem.findFirst({
      where: { itemId, deletedAt: null },
      include: {
        partner: { select: { name: true } },
        supplier: { select: { name: true } },
        transactions: {
          orderBy: { performedAt: "desc" },
          include: {
            performer: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!item) throw new ApiError(404, "Inventory item not found");

    return NextResponse.json({
      item: toInventoryItemDTO(item),
      transactions: item.transactions.map(toInventoryTransactionDTO),
    });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("inventory:write");
    const itemId = await getItemId(params);
    const data = await parseBody(request, inventoryItemUpdateSchema);

    const existing = await prisma.inventoryItem.findFirst({
      where: { itemId, deletedAt: null },
      select: { itemId: true },
    });
    if (!existing) throw new ApiError(404, "Inventory item not found");

    try {
      const item = await prisma.inventoryItem.update({
        where: { itemId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.barcode !== undefined ? { barcode: data.barcode } : {}),
          ...(data.unit !== undefined ? { unit: data.unit } : {}),
          ...(data.reorderLevel !== undefined
            ? { reorderLevel: data.reorderLevel }
            : {}),
          ...(data.salePrice !== undefined
            ? { salePrice: data.salePrice }
            : {}),
          ...(data.lastCost !== undefined ? { lastCost: data.lastCost } : {}),
          ...(data.partnerId !== undefined
            ? { partnerId: data.partnerId }
            : {}),
          ...(data.partnerSharePct !== undefined
            ? { partnerSharePct: data.partnerSharePct }
            : {}),
          ...(data.supplierId !== undefined
            ? { supplierId: data.supplierId }
            : {}),
          ...(data.expiryDate !== undefined
            ? { expiryDate: data.expiryDate }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      });
      await writeAudit(session, {
        action: "update",
        entity: "inventory_item",
        entityId: itemId,
        changes: data,
      });
      return NextResponse.json({ item: toInventoryItemDTO(item) });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ApiError(409, "That barcode is already in use.");
      }
      throw err;
    }
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("inventory:write");
    const itemId = await getItemId(params);

    const existing = await prisma.inventoryItem.findFirst({
      where: { itemId, deletedAt: null },
      select: { itemId: true },
    });
    if (!existing) throw new ApiError(404, "Inventory item not found");

    // Soft-delete: never hard-delete inventory. Keeps the transaction history
    // and any invoice line-item references intact.
    await prisma.inventoryItem.update({
      where: { itemId },
      data: { deletedAt: new Date() },
    });
    await writeAudit(session, {
      action: "delete",
      entity: "inventory_item",
      entityId: itemId,
      changes: { softDelete: true },
    });
    return NextResponse.json({ ok: true });
  });
}
