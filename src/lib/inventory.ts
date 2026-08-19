import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { toDateOnly } from "@/utils/format";
import { INVENTORY_CATEGORIES } from "@/constants/inventory";
import { UNCATEGORISED, categorySlug } from "@/utils/inventory";
import type {
  InventoryItemDTO,
  InventoryTransactionDTO,
} from "@/types/entities";
import type { InventoryTxType } from "@/types/enums";

// Shape returned by inventory item queries.
type ItemRow = {
  needsReview: boolean;
  reviewNote: string | null;
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
    needsReview: i.needsReview,
    reviewNote: i.reviewNote,
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

// ---- Inventory list (paged, per category) ----

/**
 * The inventory page loads one category at a time. Previously it fetched every
 * item with its partner and supplier joined, then grouped them client-side into
 * accordions, so all 1,744 rows were in the DOM at once. Now the category is
 * part of the route, the query returns one page, and the tab strip is served by
 * a single grouped count.
 */
export interface InventoryListQuery {
  /** Exact category. `UNCATEGORISED` selects items with no category set. */
  category?: string;
  q?: string;
  lowStock?: boolean;
  /** Supplier id, or "none" for items with no usual supplier yet. */
  supplier?: string;
  page?: number;
  pageSize?: number;
}

export interface InventoryListPage {
  items: InventoryItemDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InventoryCategoryCount {
  category: string;
  slug: string;
  count: number;
  lowStockCount: number;
}

export const INVENTORY_PAGE_SIZE = 25;
const MAX_INVENTORY_PAGE_SIZE = 100;

/**
 * Ids of items at or below their reorder level.
 *
 * Low stock compares two columns, and Prisma cannot express that in a `where`
 * (reorder_level is an Int, current_stock a Decimal). The old list filtered
 * after mapping, which was fine while it fetched everything, but silently
 * wrong once the query is paged: it would take a page and then filter it. So
 * the ids are selected first and used as a filter.
 */
async function lowStockItemIds(): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ item_id: number }[]>`
    SELECT item_id FROM inventory_items
    WHERE deleted_at IS NULL
      AND reorder_level > 0
      AND current_stock <= reorder_level`;
  return rows.map((r) => r.item_id);
}

function inventoryWhere(
  query: InventoryListQuery,
  lowStockIds: number[] | null,
): Prisma.InventoryItemWhereInput {
  const q = query.q?.trim();
  const supplierId = Number(query.supplier);
  const supplierFilter: Prisma.InventoryItemWhereInput =
    query.supplier === "none"
      ? { supplierId: null }
      : query.supplier && Number.isInteger(supplierId)
        ? { supplierId }
        : {};

  const category =
    query.category === UNCATEGORISED
      ? { OR: [{ category: null }, { category: "" }] }
      : query.category
        ? { category: query.category }
        : {};

  return {
    deletedAt: null,
    ...category,
    ...supplierFilter,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { category: { contains: q, mode: "insensitive" as const } },
            { barcode: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    // "Low stock" only means something once a reorder level is configured,
    // matching isLowStock on the DTO.
    ...(lowStockIds ? { itemId: { in: lowStockIds } } : {}),
  };
}

export async function listInventory(
  query: InventoryListQuery = {},
): Promise<InventoryListPage> {
  const pageSize = Math.min(
    query.pageSize ?? INVENTORY_PAGE_SIZE,
    MAX_INVENTORY_PAGE_SIZE,
  );
  const page = Math.max(query.page ?? 1, 1);
  const where = inventoryWhere(
    query,
    query.lowStock ? await lowStockItemIds() : null,
  );

  const [rows, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      include: {
        partner: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: [{ name: "asc" }, { itemId: "asc" }],
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  return { items: rows.map(toInventoryItemDTO), total, page, pageSize };
}

/**
 * Counts per category for the tab strip. One grouped query rather than loading
 * every item to count them, and the low-stock tally comes with it so a tab can
 * show a badge without a second pass.
 */
export async function getInventoryCategories(): Promise<
  InventoryCategoryCount[]
> {
  const rows = await prisma.$queryRaw<
    { category: string | null; count: bigint; low: bigint }[]
  >`
    SELECT nullif(trim(category), '') AS category,
           count(*) AS count,
           count(*) FILTER (
             WHERE reorder_level > 0 AND current_stock <= reorder_level
           ) AS low
    FROM inventory_items
    WHERE deleted_at IS NULL
    GROUP BY 1`;

  const known: readonly string[] = INVENTORY_CATEGORIES;
  const rank = (category: string) => {
    if (category === UNCATEGORISED) return known.length + 1;
    const index = known.indexOf(category);
    return index === -1 ? known.length : index;
  };

  return rows
    .map((r) => {
      const category = r.category ?? UNCATEGORISED;
      return {
        category,
        slug: categorySlug(category),
        count: Number(r.count),
        lowStockCount: Number(r.low),
      };
    })
    .sort(
      (a, b) =>
        rank(a.category) - rank(b.category) ||
        a.category.localeCompare(b.category),
    );
}
