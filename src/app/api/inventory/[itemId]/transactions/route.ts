import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import {
  applyStockMovement,
  toInventoryItemDTO,
  toInventoryTransactionDTO,
} from "@/lib/inventory";
import { writeAudit } from "@/lib/audit";
import { inventoryTransactionSchema } from "@/schemas/inventory";

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
      select: { itemId: true },
    });
    if (!item) throw new ApiError(404, "Inventory item not found");

    const transactions = await prisma.inventoryTransaction.findMany({
      where: { itemId },
      orderBy: { performedAt: "desc" },
      include: { performer: { select: { firstName: true, lastName: true } } },
    });

    return NextResponse.json({
      transactions: transactions.map(toInventoryTransactionDTO),
    });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("inventory:write");
    const itemId = await getItemId(params);
    const data = await parseBody(request, inventoryTransactionSchema);

    const { item, transaction } = await applyStockMovement({
      itemId,
      type: data.type,
      quantity: data.quantity,
      unitCost: data.unitCost,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      notes: data.notes,
      performedBy: session.user.userId,
    });

    await writeAudit(session, {
      action: "stock",
      entity: "inventory_transaction",
      entityId: transaction.transactionId,
      changes: {
        itemId,
        type: data.type,
        quantity: data.quantity,
        newStock: item.currentStock.toNumber(),
      },
    });

    return NextResponse.json(
      {
        item: toInventoryItemDTO(item),
        transaction: toInventoryTransactionDTO(transaction),
      },
      { status: 201 },
    );
  });
}
