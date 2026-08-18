import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { toDateOnly } from "@/utils/format";
import type {
  InventoryItemDTO,
  InventoryTransactionDTO,
} from "@/types/entities";
import type { InventoryTxType } from "@/types/enums";

// Shape returned by inventory item queries.
type ItemRow = {
  itemId: number;
  name: string;
  category: string | null;
  barcode: string | null;
  unit: string | null;
  currentStock: Prisma.Decimal;
  reorderLevel: number;
  salePrice: Prisma.Decimal | null;
  lastCost: Prisma.Decimal | null;
  partnerId: number | null;
  partnerSharePct: Prisma.Decimal | null;
  supplierId: number | null;
  // Present only when the query includes the relation; absent on the bare rows
  // returned by create/update, so both stay optional.
  partner?: { name: string } | null;
  supplier?: { name: string } | null;
  expiryDate: Date | null;
  notes: string | null;
};

type TransactionRow = {
  transactionId: number;
  itemId: number;
  type: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  referenceType: string | null;
  referenceId: number | null;
  notes: string | null;
  performedAt: Date;
  performer: { firstName: string; lastName: string } | null;
};

function isExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiryDate.getTime() < today.getTime();
}

export function toInventoryItemDTO(i: ItemRow): InventoryItemDTO {
  const currentStock = i.currentStock.toNumber();
  return {
    itemId: i.itemId,
    name: i.name,
    category: i.category,
    barcode: i.barcode,
    unit: i.unit,
    currentStock,
    reorderLevel: i.reorderLevel,
    salePrice: i.salePrice ? i.salePrice.toString() : null,
    lastCost: i.lastCost ? i.lastCost.toString() : null,
    partnerId: i.partnerId,
    partnerName: i.partner?.name ?? null,
    partnerSharePct: i.partnerSharePct ? i.partnerSharePct.toString() : null,
    supplierId: i.supplierId,
    supplierName: i.supplier?.name ?? null,
    expiryDate: toDateOnly(i.expiryDate),
    notes: i.notes,
    // Only nag about reorder when a level is actually configured.
    isLowStock: i.reorderLevel > 0 && currentStock <= i.reorderLevel,
    isExpired: isExpired(i.expiryDate),
  };
}

export function toInventoryTransactionDTO(
  t: TransactionRow,
): InventoryTransactionDTO {
  return {
    transactionId: t.transactionId,
    itemId: t.itemId,
    type: t.type as InventoryTxType,
    quantity: t.quantity.toNumber(),
    unitCost: t.unitCost ? t.unitCost.toString() : null,
    salePrice: t.salePrice ? t.salePrice.toString() : null,
    referenceType: t.referenceType,
    referenceId: t.referenceId,
    notes: t.notes,
    performedAt: t.performedAt.toISOString(),
    performerName: t.performer
      ? `${t.performer.firstName} ${t.performer.lastName}`
      : null,
  };
}

// Convert the request's quantity into the signed value stored on the
// transaction (and added to current_stock). Received adds, Used/Sold/Expired
// subtract, Adjusted is already a signed correction.
export function signedDelta(type: InventoryTxType, quantity: number): number {
  if (type === "Received") return Math.abs(quantity);
  if (type === "Adjusted") return quantity;
  return -Math.abs(quantity);
}

// The DB CHECK (current_stock >= 0) rejects any movement that would oversell.
// Postgres reports it as check_violation (SQLSTATE 23514) naming the column.
export function isStockCheckViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: unknown; meta?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  const metaCode =
    e.meta && typeof e.meta === "object" && "code" in e.meta
      ? String((e.meta as { code?: unknown }).code)
      : "";
  return (
    e.code === "23514" ||
    metaCode === "23514" ||
    message.includes("current_stock")
  );
}

export function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

const txInclude = {
  performer: { select: { firstName: true, lastName: true } },
} as const;

export interface StockMovementParams {
  itemId: number;
  type: InventoryTxType;
  quantity: number;
  unitCost?: number;
  referenceType?: string;
  referenceId?: number;
  notes?: string;
  performedBy: number | null;
}

// Record one stock movement and apply it to current_stock, inside a transaction
// the caller owns. Receiving a purchase order writes many movements that must
// all land or none, so it drives this directly rather than calling
// applyStockMovement per line and getting one transaction each.
export async function applyStockMovementTx(
  tx: Prisma.TransactionClient,
  params: StockMovementParams,
) {
  const delta = signedDelta(params.type, params.quantity);

  const item = await tx.inventoryItem.findFirst({
    where: { itemId: params.itemId, deletedAt: null },
    select: { itemId: true, lastCost: true },
  });
  if (!item) throw new ApiError(404, "Inventory item not found");

  // Stock consumed in the clinic or written off leaves without a sale, so no
  // cost gets frozen on it the way a Sold movement freezes one from the invoice.
  // Default it from the item's latest purchase cost, so the value of what was
  // used or binned is on record rather than lost. The caller sends nothing, so
  // nobody has to type it.
  //
  // Recording it does NOT charge it to profit: consumables are expensed through
  // running costs, and charging them here as well would count the same stock
  // twice. Analytics reports these separately for visibility.
  const unitCost =
    params.unitCost ??
    (params.type === "Used" || params.type === "Expired"
      ? (item.lastCost ?? undefined)
      : undefined);

  const transaction = await tx.inventoryTransaction.create({
    data: {
      itemId: params.itemId,
      performedBy: params.performedBy,
      type: params.type,
      quantity: delta,
      unitCost,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      notes: params.notes,
    },
    include: txInclude,
  });

  const updated = await tx.inventoryItem.update({
    where: { itemId: params.itemId },
    data: {
      currentStock: { increment: delta },
      // Receiving stock refreshes the most-recent purchase cost.
      ...(params.type === "Received" && params.unitCost !== undefined
        ? { lastCost: params.unitCost }
        : {}),
    },
  });

  return { item: updated, transaction };
}

// Turn a raw movement failure into the API error the client should see. Shared
// by every caller that writes movements, so the oversell message is identical
// whether one movement failed or one line of a received order did.
export function rethrowStockMovementError(err: unknown): never {
  if (err instanceof ApiError) throw err;
  if (isStockCheckViolation(err)) {
    throw new ApiError(409, "This movement would take stock below zero.");
  }
  throw err;
}

// Record a stock movement and apply it to current_stock atomically. The insert
// and the increment live in one transaction, so a CHECK failure (oversell)
// rolls back the movement too. The increment is computed by the DB, making it
// safe against concurrent movements.
export async function applyStockMovement(params: StockMovementParams) {
  try {
    return await prisma.$transaction((tx) => applyStockMovementTx(tx, params));
  } catch (err) {
    rethrowStockMovementError(err);
  }
}
