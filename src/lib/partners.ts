import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/utils/format";
import { rangeBounds } from "@/utils/date-range";
import type {
  AnalyticsRange,
  PartnerDTO,
  PartnerEarningDTO,
  PartnerItemPerformanceDTO,
  PartnerMoneyDTO,
  PartnerPayoutDTO,
} from "@/types/entities";
import type { InventoryTxType } from "@/types/enums";

type DecimalInput = string | number | Prisma.Decimal;

const D = (v: DecimalInput) => new Prisma.Decimal(v);

// Mirrors formatInvoiceNumber from lib/invoices; kept local so this module does
// not import lib/invoices (which imports the partner math here, forming a cycle).
function invoiceNumber(id: number): string {
  return `INV-${String(id).padStart(5, "0")}`;
}

// Amount owed to a partner for one sold line: their cost back plus the agreed
// share of the profit. The partner always gets their cost back; the profit
// share only applies when the sale beat the cost (floored at zero, so a sale
// below cost never charges the partner a negative share).
export function computePartnerPayable(
  quantity: DecimalInput,
  salePrice: DecimalInput,
  cost: DecimalInput,
  sharePct: DecimalInput,
): Prisma.Decimal {
  const qty = D(quantity);
  const unitCost = D(cost);
  const diff = D(salePrice).minus(unitCost);
  const profit = diff.greaterThan(0) ? diff : D(0);
  const sharePerUnit = profit.times(D(sharePct)).dividedBy(100);
  return qty.times(unitCost.plus(sharePerUnit)).toDecimalPlaces(2);
}

// Effective profit-share %: the per-item override when set, else the partner
// default, else zero.
export function effectiveSharePct(
  itemSharePct: Prisma.Decimal | null,
  partnerDefaultPct: Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  return itemSharePct ?? partnerDefaultPct ?? D(0);
}

// ---- Row shapes ----

type PartnerRow = {
  partnerId: number;
  name: string;
  phone: string | null;
  defaultSharePct: Prisma.Decimal;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
};

// Raw sums for one partner, before the derived figures are worked out. Kept
// separate from the DTO so the arithmetic lives in exactly one place.
type PartnerTotals = {
  revenue: Prisma.Decimal;
  costOfSales: Prisma.Decimal;
  accrued: Prisma.Decimal;
  unitsSold: Prisma.Decimal;
};

const emptyTotals = (): PartnerTotals => ({
  revenue: D(0),
  costOfSales: D(0),
  accrued: D(0),
  unitsSold: D(0),
});

type PartnerStats = {
  itemCount: number;
  // Flow over the selected range.
  inRange: PartnerTotals;
  paidInRange: Prisma.Decimal;
  // Position as at the range's last day: cumulative from the beginning of time
  // up to that date, not confined to the range.
  toDate: PartnerTotals;
  paidToDate: Prisma.Decimal;
  capitalOnShelf: Prisma.Decimal;
};

// Movements that represent a sale or its reversal. A Sold line carries a negative
// quantity, and voiding it writes an Adjusted line with the same frozen cost and
// sale price at positive quantity, so summing `-quantity * price` across both
// nets a voided sale back to zero without special-casing it.
const SALE_MOVEMENT_FILTER: Prisma.InventoryTransactionWhereInput = {
  OR: [{ type: "Sold" }, { type: "Adjusted", referenceType: "invoice" }],
};

// Turn a partner's sale movements into the four raw sums.
function sumSaleMovements(
  rows: {
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    salePrice: Prisma.Decimal | null;
    partnerPayable: Prisma.Decimal | null;
  }[],
): PartnerTotals {
  const totals = emptyTotals();
  for (const row of rows) {
    // Sign flip: outbound stock (negative quantity) adds to revenue and cost.
    const sold = row.quantity.negated();
    totals.unitsSold = totals.unitsSold.plus(sold);
    if (row.salePrice) {
      totals.revenue = totals.revenue.plus(sold.times(row.salePrice));
    }
    if (row.unitCost) {
      totals.costOfSales = totals.costOfSales.plus(sold.times(row.unitCost));
    }
    totals.accrued = totals.accrued.plus(row.partnerPayable ?? 0);
  }
  return totals;
}

// The derived view the UI reads. Every figure here is arithmetic on the sums
// above, so the definitions cannot drift between the list and the detail page.
//
// The key split: `accrued` is what the clinic owes for a sale, and it is the
// partner's capital coming back PLUS their cut of the profit. Reporting it as
// "earned" is what makes capital and profit look like the same thing.
function toMoneyDTO(stats: PartnerStats): PartnerMoneyDTO {
  const { inRange, toDate } = stats;

  const partnerShare = inRange.accrued.minus(inRange.costOfSales);
  const grossProfit = inRange.revenue.minus(inRange.costOfSales);
  // Can go negative: a sale below cost still returns the partner their full
  // cost and pays them no share, so the clinic absorbs the whole shortfall.
  const clinicShare = grossProfit.minus(partnerShare);

  const balance = toDate.accrued.minus(stats.paidToDate);

  // What the partner had in play at that date: the cost of everything that had
  // sold by then (recovered) plus the cost of what was still on the shelf. Not a
  // separate query, just the two halves added up.
  const capitalRecovered = toDate.costOfSales;
  const capitalDeployed = capitalRecovered.plus(stats.capitalOnShelf);
  const sellThrough = capitalDeployed.isZero()
    ? D(0)
    : capitalRecovered.dividedBy(capitalDeployed).times(100);

  // Split the outstanding balance into capital and profit. A payout is a bare
  // amount and says nothing about which half it settles, so a convention is
  // needed: capital is settled first, which matches how the arrangement reads
  // (give the partner their money back, then their cut) and means a part-paid
  // partner sees "capital is back, the rest is your share" rather than two
  // half-settled numbers.
  //
  // The two always sum to the balance, including when payouts have overshot: a
  // negative profitOwed then reads as an overpayment, which is the truth.
  const profitShareToDate = toDate.accrued.minus(capitalRecovered);
  const capitalOutstanding = capitalRecovered.minus(stats.paidToDate);
  const capitalOwed = capitalOutstanding.greaterThan(0)
    ? capitalOutstanding
    : D(0);
  const profitOwed = balance.minus(capitalOwed);

  return {
    revenue: inRange.revenue.toFixed(2),
    costOfSales: inRange.costOfSales.toFixed(2),
    grossProfit: grossProfit.toFixed(2),
    partnerShare: partnerShare.toFixed(2),
    clinicShare: clinicShare.toFixed(2),
    accrued: inRange.accrued.toFixed(2),
    unitsSold: inRange.unitsSold.toString(),
    paidInRange: stats.paidInRange.toFixed(2),
    earnedToDate: toDate.accrued.toFixed(2),
    paidToDate: stats.paidToDate.toFixed(2),
    balance: balance.toFixed(2),
    capitalOwed: capitalOwed.toFixed(2),
    profitOwed: profitOwed.toFixed(2),
    profitShareToDate: profitShareToDate.toFixed(2),
    capitalDeployed: capitalDeployed.toFixed(2),
    capitalOnShelf: stats.capitalOnShelf.toFixed(2),
    capitalRecoveredToDate: capitalRecovered.toFixed(2),
    sellThroughPct: sellThrough.toDecimalPlaces(1).toString(),
  };
}

type EarningRow = {
  transactionId: number;
  performedAt: Date;
  type: string;
  quantity: Prisma.Decimal;
  partnerPayable: Prisma.Decimal | null;
  referenceType: string | null;
  referenceId: number | null;
  item: { name: string };
};

export const partnerPayoutInclude = {
  creator: { select: { firstName: true, lastName: true } },
} as const;

type PayoutRow = Prisma.PartnerPayoutGetPayload<{
  include: typeof partnerPayoutInclude;
}>;

// ---- DTO mappers ----

export function toPartnerDTO(p: PartnerRow, stats?: PartnerStats): PartnerDTO {
  const dto: PartnerDTO = {
    partnerId: p.partnerId,
    name: p.name,
    phone: p.phone,
    defaultSharePct: p.defaultSharePct.toString(),
    notes: p.notes,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
  if (stats) {
    dto.itemCount = stats.itemCount;
    dto.money = toMoneyDTO(stats);
  }
  return dto;
}

export function toPartnerPayoutDTO(p: PayoutRow): PartnerPayoutDTO {
  return {
    payoutId: p.payoutId,
    partnerId: p.partnerId,
    amount: p.amount.toFixed(2),
    paidOn: toDateOnly(p.paidOn) ?? "",
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    createdByName: p.creator
      ? `${p.creator.firstName} ${p.creator.lastName}`
      : null,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toPartnerEarningDTO(t: EarningRow): PartnerEarningDTO {
  return {
    transactionId: t.transactionId,
    performedAt: t.performedAt.toISOString(),
    type: t.type as InventoryTxType,
    itemName: t.item.name,
    quantity: t.quantity.toString(),
    payable: (t.partnerPayable ?? D(0)).toFixed(2),
    invoiceNumber:
      t.referenceType === "invoice" && t.referenceId != null
        ? invoiceNumber(t.referenceId)
        : null,
  };
}

// ---- Ledger reads ----

// ---- grouping helpers ----

function groupByPartner<T extends { partnerId: number | null }>(
  rows: T[],
): Map<number, T[]> {
  const buckets = new Map<number, T[]>();
  for (const row of rows) {
    if (row.partnerId == null) continue;
    const bucket = buckets.get(row.partnerId);
    if (bucket) bucket.push(row);
    else buckets.set(row.partnerId, [row]);
  }
  return buckets;
}

function mapValues<K, V, R>(
  source: Map<K, V>,
  transform: (value: V) => R,
): Map<K, R> {
  return new Map([...source].map(([key, value]) => [key, transform(value)]));
}

type ShelfRow = {
  itemId: number;
  currentStock: Prisma.Decimal;
  lastCost: Prisma.Decimal | null;
};

// What was on the shelf at the end of the range, worked back from today by
// reversing every movement recorded since. Movements are signed, so a receipt
// subtracts and a sale adds back.
//
// Both the quantity shown and the value derived from it go through here, so the
// two can never end up stating different dates: reading a row as "120 in stock,
// $0.00 held" was exactly that bug.
function stockAsAt(
  item: ShelfRow,
  movedSince?: Map<number, Prisma.Decimal>,
): Prisma.Decimal {
  const since = movedSince?.get(item.itemId) ?? D(0);
  const stock = item.currentStock.minus(since);
  // Floor at zero: a rollback can only go negative on inconsistent data, and
  // negative stock would be nonsense either way.
  return stock.greaterThan(0) ? stock : D(0);
}

// Unsold consigned stock as it stood at the end of the range: the partner's
// money still tied up rather than recovered.
//
// Quantities are exact. The valuation uses each item's *current* lastCost, which
// is the same approximation the live figure already makes: purchase cost is only
// kept as "most recent", not as a history.
function sumShelfValue(
  rows: ShelfRow[],
  movedSince?: Map<number, Prisma.Decimal>,
): Prisma.Decimal {
  return rows.reduce(
    (sum, item) =>
      sum.plus(stockAsAt(item, movedSince).times(item.lastCost ?? 0)),
    D(0),
  );
}

// Shape of the movement rows every partner figure is derived from. Selected once
// here so the list, the detail page and the per-item breakdown all read the same
// frozen columns.
const saleMovementSelect = {
  partnerId: true,
  itemId: true,
  quantity: true,
  unitCost: true,
  salePrice: true,
  partnerPayable: true,
} as const;

// All partners. Sales figures cover `range`; balance and capital figures are the
// position as at its last day. Two passes over the movements rather than one:
// flow over a period and position at a date answer different questions and must
// not be conflated.
export async function getPartnersWithStats(
  range: AnalyticsRange,
): Promise<PartnerDTO[]> {
  const { from, toExclusive } = rangeBounds(range);

  const [
    partners,
    rangeRows,
    toDateRows,
    paidInRangeGroups,
    paidToDateGroups,
    items,
    movedSinceGroups,
  ] = await Promise.all([
    prisma.partner.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        partnerId: { not: null },
        performedAt: { gte: from, lt: toExclusive },
        ...SALE_MOVEMENT_FILTER,
      },
      select: saleMovementSelect,
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        partnerId: { not: null },
        performedAt: { lt: toExclusive },
        ...SALE_MOVEMENT_FILTER,
      },
      select: saleMovementSelect,
    }),
    prisma.partnerPayout.groupBy({
      by: ["partnerId"],
      where: { deletedAt: null, paidOn: { gte: from, lt: toExclusive } },
      _sum: { amount: true },
    }),
    prisma.partnerPayout.groupBy({
      by: ["partnerId"],
      where: { deletedAt: null, paidOn: { lt: toExclusive } },
      _sum: { amount: true },
    }),
    prisma.inventoryItem.findMany({
      where: { partnerId: { not: null }, deletedAt: null },
      select: {
        itemId: true,
        partnerId: true,
        currentStock: true,
        lastCost: true,
      },
    }),
    // Every movement since the range ended, so today's stock can be rolled back
    // to what was on the shelf then. Empty when the range ends today, which is
    // the default, so the usual view costs nothing extra.
    prisma.inventoryTransaction.groupBy({
      by: ["itemId"],
      where: {
        performedAt: { gte: toExclusive },
        item: { partnerId: { not: null } },
      },
      _sum: { quantity: true },
    }),
  ]);

  const movedSince = new Map(
    movedSinceGroups.map((g) => [g.itemId, g._sum.quantity ?? D(0)]),
  );

  const rangeMap = mapValues(groupByPartner(rangeRows), sumSaleMovements);
  const toDateMap = mapValues(groupByPartner(toDateRows), sumSaleMovements);
  const itemsByPartner = groupByPartner(items);
  const shelfMap = mapValues(itemsByPartner, (rows) =>
    sumShelfValue(rows, movedSince),
  );
  const itemCountMap = mapValues(itemsByPartner, (rows) => rows.length);
  const paidInRangeMap = new Map(
    paidInRangeGroups.map((g) => [g.partnerId, g._sum.amount ?? D(0)]),
  );
  const paidToDateMap = new Map(
    paidToDateGroups.map((g) => [g.partnerId, g._sum.amount ?? D(0)]),
  );

  return partners.map((p) =>
    toPartnerDTO(p, {
      itemCount: itemCountMap.get(p.partnerId) ?? 0,
      inRange: rangeMap.get(p.partnerId) ?? emptyTotals(),
      paidInRange: paidInRangeMap.get(p.partnerId) ?? D(0),
      toDate: toDateMap.get(p.partnerId) ?? emptyTotals(),
      paidToDate: paidToDateMap.get(p.partnerId) ?? D(0),
      capitalOnShelf: shelfMap.get(p.partnerId) ?? D(0),
    }),
  );
}

// Active partners only, for the inventory item picker (no stats needed).
export async function getActivePartners(): Promise<PartnerDTO[]> {
  const partners = await prisma.partner.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
  });
  return partners.map((p) => toPartnerDTO(p));
}

export interface PartnerDetailData {
  partner: PartnerDTO;
  itemPerformance: PartnerItemPerformanceDTO[];
  earnings: PartnerEarningDTO[];
  payouts: PartnerPayoutDTO[];
}

export async function getPartnerDetail(
  partnerId: number,
  range: AnalyticsRange,
): Promise<PartnerDetailData | null> {
  const partner = await prisma.partner.findFirst({
    where: { partnerId, deletedAt: null },
  });
  if (!partner) return null;

  const { from, toExclusive } = rangeBounds(range);

  const [
    rangeRows,
    toDateRows,
    paidInRangeAgg,
    paidToDateAgg,
    items,
    movedSinceGroups,
    earnings,
    payouts,
  ] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        partnerId,
        performedAt: { gte: from, lt: toExclusive },
        ...SALE_MOVEMENT_FILTER,
      },
      select: saleMovementSelect,
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        partnerId,
        performedAt: { lt: toExclusive },
        ...SALE_MOVEMENT_FILTER,
      },
      select: saleMovementSelect,
    }),
    prisma.partnerPayout.aggregate({
      _sum: { amount: true },
      where: {
        partnerId,
        deletedAt: null,
        paidOn: { gte: from, lt: toExclusive },
      },
    }),
    prisma.partnerPayout.aggregate({
      _sum: { amount: true },
      where: { partnerId, deletedAt: null, paidOn: { lt: toExclusive } },
    }),
    prisma.inventoryItem.findMany({
      where: { partnerId, deletedAt: null },
      select: {
        itemId: true,
        name: true,
        unit: true,
        partnerId: true,
        currentStock: true,
        lastCost: true,
      },
      orderBy: { name: "asc" },
    }),
    // Movements since the range ended, so stock can be rolled back to what was
    // on the shelf then.
    prisma.inventoryTransaction.groupBy({
      by: ["itemId"],
      where: { performedAt: { gte: toExclusive }, item: { partnerId } },
      _sum: { quantity: true },
    }),
    prisma.inventoryTransaction.findMany({
      where: { partnerId },
      orderBy: { performedAt: "desc" },
      take: 100,
      select: {
        transactionId: true,
        performedAt: true,
        type: true,
        quantity: true,
        partnerPayable: true,
        referenceType: true,
        referenceId: true,
        item: { select: { name: true } },
      },
    }),
    prisma.partnerPayout.findMany({
      where: { partnerId, deletedAt: null },
      orderBy: [{ paidOn: "desc" }, { payoutId: "desc" }],
      include: partnerPayoutInclude,
    }),
  ]);

  const movedSince = new Map(
    movedSinceGroups.map((g) => [g.itemId, g._sum.quantity ?? D(0)]),
  );

  // Per-item performance over the range. Every item the partner sources appears,
  // including ones that sold nothing, since a line sitting still is exactly what
  // the clinic wants to spot.
  const rowsByItem = new Map<number, typeof rangeRows>();
  for (const row of rangeRows) {
    const bucket = rowsByItem.get(row.itemId);
    if (bucket) bucket.push(row);
    else rowsByItem.set(row.itemId, [row]);
  }

  const itemPerformance: PartnerItemPerformanceDTO[] = items.map((item) => {
    const totals = sumSaleMovements(rowsByItem.get(item.itemId) ?? []);
    const partnerShare = totals.accrued.minus(totals.costOfSales);
    const grossProfit = totals.revenue.minus(totals.costOfSales);
    return {
      itemId: item.itemId,
      itemName: item.name,
      unit: item.unit,
      currentStock: stockAsAt(item, movedSince).toNumber(),
      capitalOnShelf: sumShelfValue([item], movedSince).toFixed(2),
      unitsSold: totals.unitsSold.toString(),
      revenue: totals.revenue.toFixed(2),
      costOfSales: totals.costOfSales.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      partnerShare: partnerShare.toFixed(2),
      clinicShare: grossProfit.minus(partnerShare).toFixed(2),
    };
  });

  return {
    partner: toPartnerDTO(partner, {
      itemCount: items.length,
      inRange: sumSaleMovements(rangeRows),
      toDate: sumSaleMovements(toDateRows),
      paidInRange: paidInRangeAgg._sum.amount ?? D(0),
      paidToDate: paidToDateAgg._sum.amount ?? D(0),
      capitalOnShelf: sumShelfValue(items, movedSince),
    }),
    itemPerformance,
    earnings: earnings.map(toPartnerEarningDTO),
    payouts: payouts.map(toPartnerPayoutDTO),
  };
}
