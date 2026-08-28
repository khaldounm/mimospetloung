import { prisma } from "@/lib/prisma";
import { BOOKING_STATUSES } from "@/types/enums";
import {
  buildBuckets,
  bucketKeyOf,
  defaultRange,
  pickGranularity,
  rangeBounds,
  dateOnlyBounds,
  priorRange,
  type Bucket,
  type Granularity,
} from "@/utils/date-range";
import {
  AD_HOC_LABEL,
  CATEGORY_GROUPS,
  GROOMING_SERVICE_CATEGORY,
  ITEM_SEARCH_LIMIT,
  NON_TRADE_SERVICE_CATEGORIES,
  TOP_ITEMS_LIMIT,
  UNCATEGORISED_LABEL,
  type CategoryGroupKey,
} from "@/constants/analytics";
import type { AnalyticsSection } from "@/schemas/analytics";
import type {
  AnalyticsDTO,
  AnalyticsRange,
  BookingsAnalytics,
  CategoriesAnalytics,
  CategoryComparison,
  CategoryTrendGroup,
  CategoryTrendRow,
  ClientsAnalytics,
  InventoryAnalytics,
  ItemPerformanceDetail,
  ItemPerformanceRow,
  ItemSearchResult,
  ItemsAnalytics,
  NamedCount,
  NamedValue,
  ProfitAnalytics,
  PurchasesAnalytics,
  RevenueAnalytics,
} from "@/types/entities";

// Invoice statuses that represent real, billable revenue (Draft is not yet
// committed, Void is cancelled).
const REVENUE_STATUSES = ["Issued", "Partial", "Paid", "Overdue"];
// Statuses whose balance can still be outstanding.
const OPEN_STATUSES = ["Issued", "Partial", "Overdue"];

const DAY_MS = 24 * 60 * 60 * 1000;

// ---- small helpers ----

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sumPayments(payments: { amount: { toNumber(): number } }[]): number {
  return payments.reduce((s, p) => s + p.amount.toNumber(), 0);
}

// Everything a range-scoped section needs: the query bounds plus the ordered
// buckets (daily for short ranges, monthly for long) and their granularity.
interface Prepared {
  from: Date;
  toExclusive: Date;
  granularity: Granularity;
  buckets: Bucket[];
}

function prepare(range: AnalyticsRange): Prepared {
  const { from, toExclusive } = rangeBounds(range);
  const granularity = pickGranularity(from, toExclusive);
  return {
    from,
    toExclusive,
    granularity,
    buckets: buildBuckets(from, toExclusive, granularity),
  };
}

// A zeroed number map keyed by bucket, ready to accumulate into.
function zeroMap(buckets: Bucket[]): Map<string, number> {
  return new Map(buckets.map((b) => [b.key, 0]));
}

function addTo(map: Map<string, number>, key: string, amount: number): void {
  const current = map.get(key);
  if (current !== undefined) map.set(key, current + amount);
}

// ---- section builders (range-scoped) ----

async function getRevenueSection(
  range: AnalyticsRange,
): Promise<RevenueAnalytics> {
  const { from, toExclusive, granularity, buckets } = prepare(range);
  const today = startOfToday();

  const [
    collectedAgg,
    invoicedAgg,
    avgAgg,
    voidCount,
    billedCount,
    openInvoices,
    trendInvoices,
    serviceGroups,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: from, lt: toExclusive } },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        status: { in: REVENUE_STATUSES },
        issuedAt: { gte: from, lt: toExclusive },
      },
    }),
    prisma.invoice.aggregate({
      _avg: { total: true },
      where: {
        status: { in: REVENUE_STATUSES },
        issuedAt: { gte: from, lt: toExclusive },
      },
    }),
    prisma.invoice.count({
      where: { status: "Void", issuedAt: { gte: from, lt: toExclusive } },
    }),
    prisma.invoice.count({
      where: { issuedAt: { gte: from, lt: toExclusive } },
    }),
    // Aging + total outstanding are a snapshot of open balances as of today, so
    // they are intentionally not filtered by the range.
    prisma.invoice.findMany({
      where: { status: { in: OPEN_STATUSES } },
      select: {
        total: true,
        dueDate: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.invoice.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        issuedAt: { gte: from, lt: toExclusive },
      },
      select: {
        total: true,
        issuedAt: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.invoiceLineItem.groupBy({
      by: ["serviceId"],
      where: {
        serviceId: { not: null },
        invoice: {
          status: { in: REVENUE_STATUSES },
          issuedAt: { gte: from, lt: toExclusive },
        },
      },
      _sum: { lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 8,
    }),
  ]);

  // Aging of outstanding balances (as of today).
  const aging = { current: 0, d1to30: 0, d31to60: 0, d61plus: 0 };
  let outstandingTotal = 0;
  for (const inv of openInvoices) {
    const balance = inv.total.toNumber() - sumPayments(inv.payments);
    if (balance <= 0) continue;
    outstandingTotal += balance;
    if (!inv.dueDate || inv.dueDate.getTime() >= today.getTime()) {
      aging.current += balance;
      continue;
    }
    const daysOverdue = Math.floor(
      (today.getTime() - inv.dueDate.getTime()) / DAY_MS,
    );
    if (daysOverdue <= 30) aging.d1to30 += balance;
    else if (daysOverdue <= 60) aging.d31to60 += balance;
    else aging.d61plus += balance;
  }

  // Collected vs still-outstanding per bucket, by issue date.
  const collectedMap = zeroMap(buckets);
  const outstandingMap = zeroMap(buckets);
  for (const inv of trendInvoices) {
    if (!inv.issuedAt) continue;
    const key = bucketKeyOf(inv.issuedAt, granularity);
    const paid = sumPayments(inv.payments);
    addTo(collectedMap, key, paid);
    addTo(outstandingMap, key, Math.max(inv.total.toNumber() - paid, 0));
  }
  const trend = buckets.map((b) => ({
    label: b.label,
    collected: round2(collectedMap.get(b.key) ?? 0),
    outstanding: round2(outstandingMap.get(b.key) ?? 0),
  }));

  // Top services by billed revenue within the range.
  const serviceIds = serviceGroups
    .map((g) => g.serviceId)
    .filter((id): id is number => id !== null);
  const services = await prisma.service.findMany({
    where: { serviceId: { in: serviceIds } },
    select: { serviceId: true, name: true },
  });
  const serviceNames = new Map(services.map((s) => [s.serviceId, s.name]));
  const byService = serviceGroups.map((g) => ({
    label: serviceNames.get(g.serviceId as number) ?? `Service #${g.serviceId}`,
    value: round2(g._sum.lineTotal?.toNumber() ?? 0),
  }));

  return {
    periodCollected: round2(collectedAgg._sum.amount?.toNumber() ?? 0),
    periodInvoiced: round2(invoicedAgg._sum.total?.toNumber() ?? 0),
    outstandingTotal: round2(outstandingTotal),
    avgInvoiceValue: round2(avgAgg._avg.total?.toNumber() ?? 0),
    voidRate: billedCount > 0 ? round2((voidCount / billedCount) * 100) : 0,
    aging: {
      current: round2(aging.current),
      d1to30: round2(aging.d1to30),
      d31to60: round2(aging.d31to60),
      d61plus: round2(aging.d61plus),
    },
    trend,
    byService,
  };
}

// Net profit within the range = revenue collected - COGS (clinic-owned) -
// partner payouts - operating (running) costs. COGS and partner payouts are the
// frozen amounts on Sold movements (bucketed by sale date, void reversals net
// out); revenue is cash collected. Self-contained so it can be queried for a
// range independent of the revenue section.
async function getProfitSection(
  range: AnalyticsRange,
): Promise<ProfitAnalytics> {
  const { from, toExclusive, granularity, buckets } = prepare(range);
  // incurredOn is a date-only column and needs calendar-date bounds.
  const { from: dateFrom, toExclusive: dateToExclusive } =
    dateOnlyBounds(range);

  const [
    costAgg,
    costRows,
    categoryGroups,
    soldRows,
    partnerRows,
    paymentRows,
    unsoldRows,
  ] = await Promise.all([
    prisma.runningCost.aggregate({
      _sum: { amount: true },
      where: {
        deletedAt: null,
        incurredOn: { gte: dateFrom, lt: dateToExclusive },
      },
    }),
    prisma.runningCost.findMany({
      where: {
        deletedAt: null,
        incurredOn: { gte: dateFrom, lt: dateToExclusive },
      },
      select: { incurredOn: true, amount: true },
    }),
    prisma.runningCost.groupBy({
      by: ["category"],
      where: {
        deletedAt: null,
        incurredOn: { gte: dateFrom, lt: dateToExclusive },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 8,
    }),
    // Sold movements carry the frozen unit cost; COGS = |qty| * unitCost. Giving
    // a sale back writes a Returned movement (referenceType "invoice") carrying
    // the same frozen cost at the opposite sign, so the signed sum below nets it
    // out. That covers both a voided invoice and a counter return, because they
    // are the same event to the ledger and now share one type. Consigned items
    // (partnerId set) are excluded here and counted as partner payouts instead,
    // so their cost is not double-counted.
    prisma.inventoryTransaction.findMany({
      where: {
        partnerId: null,
        unitCost: { not: null },
        performedAt: { gte: from, lt: toExclusive },
        OR: [{ type: "Sold" }, { type: "Returned", referenceType: "invoice" }],
      },
      select: { performedAt: true, quantity: true, unitCost: true },
    }),
    // Consignment payouts: the frozen amount owed to partners on their sold
    // items. Void reversals carry a negative payable, so they net out.
    prisma.inventoryTransaction.findMany({
      where: {
        partnerId: { not: null },
        performedAt: { gte: from, lt: toExclusive },
      },
      select: { performedAt: true, partnerPayable: true },
    }),
    // Collected revenue for the profit trend (cash basis).
    prisma.payment.findMany({
      where: { paidAt: { gte: from, lt: toExclusive } },
      select: { paidAt: true, amount: true },
    }),
    // Stock that left without a sale. Reported alongside profit, never inside
    // it: consumables are expensed via running costs, so charging their cost
    // here as well would count the same stock twice. Surfacing the figure lets
    // the clinic see what it consumes and what it bins.
    prisma.inventoryTransaction.findMany({
      where: {
        type: { in: ["Used", "Expired"] },
        unitCost: { not: null },
        performedAt: { gte: from, lt: toExclusive },
      },
      select: { type: true, quantity: true, unitCost: true },
    }),
  ]);

  const costMap = zeroMap(buckets);
  for (const row of costRows) {
    addTo(
      costMap,
      bucketKeyOf(row.incurredOn, granularity),
      row.amount.toNumber(),
    );
  }

  const cogsMap = zeroMap(buckets);
  for (const row of soldRows) {
    // Signed by direction: a Sold line has negative quantity (adds cost), a void
    // reversal has positive quantity (removes it), so a voided sale nets to zero.
    const cost = -row.quantity.toNumber() * (row.unitCost?.toNumber() ?? 0);
    addTo(cogsMap, bucketKeyOf(row.performedAt, granularity), cost);
  }

  const partnerMap = zeroMap(buckets);
  for (const row of partnerRows) {
    addTo(
      partnerMap,
      bucketKeyOf(row.performedAt, granularity),
      row.partnerPayable?.toNumber() ?? 0,
    );
  }

  const revenueMap = zeroMap(buckets);
  for (const row of paymentRows) {
    addTo(
      revenueMap,
      bucketKeyOf(row.paidAt, granularity),
      row.amount.toNumber(),
    );
  }

  const trend = buckets.map((b) => {
    const revenue = round2(revenueMap.get(b.key) ?? 0);
    const cogs = round2(cogsMap.get(b.key) ?? 0);
    const partnerPayouts = round2(partnerMap.get(b.key) ?? 0);
    const costs = round2(costMap.get(b.key) ?? 0);
    return {
      label: b.label,
      revenue,
      cogs,
      partnerPayouts,
      costs,
      profit: round2(revenue - cogs - partnerPayouts - costs),
    };
  });

  // Full cost breakdown: operating-cost categories plus COGS and partner payouts
  // as their own slices, so the chart shows where every cost dollar goes.
  const cogsTotal = round2([...cogsMap.values()].reduce((s, v) => s + v, 0));
  const partnerTotal = round2(
    [...partnerMap.values()].reduce((s, v) => s + v, 0),
  );
  const byCategory: NamedValue[] = categoryGroups.map((g) => ({
    label: g.category,
    value: round2(g._sum.amount?.toNumber() ?? 0),
  }));
  if (cogsTotal > 0)
    byCategory.push({ label: "Cost of goods sold", value: cogsTotal });
  if (partnerTotal > 0)
    byCategory.push({ label: "Partner payouts", value: partnerTotal });
  byCategory.sort((a, b) => b.value - a.value);
  byCategory.splice(8);

  const periodRevenue = round2(
    paymentRows.reduce((s, p) => s + p.amount.toNumber(), 0),
  );
  const periodCosts = round2(costAgg._sum.amount?.toNumber() ?? 0);
  // Note what is absent: clinic use and write-offs. They are reported below but
  // never subtracted here, because running costs already expense consumables.
  const periodProfit = round2(
    periodRevenue - cogsTotal - partnerTotal - periodCosts,
  );

  // Used and Expired both carry a negative quantity, so negating gives the
  // amount that left the shelf.
  let clinicUse = 0;
  let writeOffs = 0;
  for (const row of unsoldRows) {
    const value = -row.quantity.toNumber() * (row.unitCost?.toNumber() ?? 0);
    if (row.type === "Used") clinicUse += value;
    else writeOffs += value;
  }

  return {
    periodRevenue,
    periodCogs: cogsTotal,
    periodPartnerPayouts: partnerTotal,
    periodCosts,
    periodProfit,
    periodClinicUse: round2(clinicUse),
    periodWriteOffs: round2(writeOffs),
    trend,
    byCategory,
  };
}

async function getBookingsSection(
  range: AnalyticsRange,
): Promise<BookingsAnalytics> {
  const { from, toExclusive, granularity, buckets } = prepare(range);

  const rows = await prisma.booking.findMany({
    where: { startsAt: { gte: from, lt: toExclusive } },
    select: { startsAt: true, status: true },
  });

  const volMap = zeroMap(buckets);
  const statusCounts = new Map<string, number>();
  const dayCounts = new Array(7).fill(0) as number[];
  for (const r of rows) {
    addTo(volMap, bucketKeyOf(r.startsAt, granularity), 1);
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
    // getDay(): 0=Sun..6=Sat -> shift so Mon=0.
    dayCounts[(r.startsAt.getDay() + 6) % 7] += 1;
  }

  const volumeTrend: NamedCount[] = buckets.map((b) => ({
    label: b.label,
    count: volMap.get(b.key) ?? 0,
  }));

  const statusMix: NamedCount[] = BOOKING_STATUSES.filter((s) =>
    statusCounts.has(s),
  ).map((s) => ({ label: s, count: statusCounts.get(s)! }));

  const total = rows.length;
  const pct = (n: number) => (total > 0 ? round2((n / total) * 100) : 0);

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const byWeekday: NamedCount[] = dayLabels.map((label, i) => ({
    label,
    count: dayCounts[i],
  }));

  return {
    periodCount: total,
    noShowRate: pct(statusCounts.get("No Show") ?? 0),
    cancellationRate: pct(statusCounts.get("Cancelled") ?? 0),
    completedRate: pct(statusCounts.get("Completed") ?? 0),
    volumeTrend,
    statusMix,
    byWeekday,
  };
}

// ---- category performance (period over period) ----

// Billed revenue per category for one window, as group -> category -> total.
//
// Billed rather than collected, on purpose: a payment settles an invoice, not a
// line, so cash cannot honestly be attributed to a category. Returns carry a
// negative lineTotal (see InvoiceLineItem.returnedFromLineId), so a refunded
// sale subtracts itself from its own category with no special handling here.
async function billedByCategory(
  range: AnalyticsRange,
): Promise<Map<CategoryGroupKey, Map<string, number>>> {
  const { from, toExclusive } = rangeBounds(range);

  const lines = await prisma.invoiceLineItem.findMany({
    where: {
      // A hidden line was consumed by the clinic, not billed. Its line_total is
      // still whatever the item would have sold for, so leaving it in would
      // report a box of gloves as revenue nobody was ever charged.
      isHidden: false,
      invoice: {
        status: { in: REVENUE_STATUSES },
        issuedAt: { gte: from, lt: toExclusive },
      },
    },
    select: {
      lineTotal: true,
      item: { select: { category: true } },
      service: { select: { category: true } },
    },
  });

  const out = new Map<CategoryGroupKey, Map<string, number>>(
    CATEGORY_GROUPS.map((g) => [g.key, new Map<string, number>()]),
  );
  for (const line of lines) {
    const [group, label] = classifyLine(line);
    const bucket = out.get(group)!;
    bucket.set(label, (bucket.get(label) ?? 0) + line.lineTotal.toNumber());
  }
  return out;
}

// Which business line a sold line belongs to, and under what name. A service
// line takes the service's category, split so grooming reads as its own trade
// rather than as veterinary work; a stock line takes the item's category.
function classifyLine(line: {
  item: { category: string | null } | null;
  service: { category: string | null } | null;
}): [CategoryGroupKey, string] {
  if (line.service) {
    const category = line.service.category ?? UNCATEGORISED_LABEL;
    if (NON_TRADE_SERVICE_CATEGORIES.has(category)) return ["other", category];
    return [
      category === GROOMING_SERVICE_CATEGORY ? "grooming" : "vet",
      category,
    ];
  }
  if (line.item) return ["products", line.item.category ?? UNCATEGORISED_LABEL];
  // Neither: a free-text line typed at the counter, with no category to take.
  return ["other", AD_HOC_LABEL];
}

function sumValues(map: Map<string, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}

function toTrendRow(
  label: string,
  current: number,
  prior: number,
): CategoryTrendRow {
  const delta = current - prior;
  return {
    label,
    current: round2(current),
    prior: round2(prior),
    delta: round2(delta),
    // Only a positive base gives a percentage any meaning. A window that billed
    // nothing, or that netted negative on returns, gets null and reads as "new"
    // rather than as a number the reader would have to distrust.
    percent: prior > 0 ? round2((delta / prior) * 100) : null,
  };
}

// Pair one window's totals against another's. Categories are unioned across
// both, so a line that sold last year and not this year still appears, showing
// the drop instead of quietly vanishing from the report.
function compareCategories(
  priorWindow: AnalyticsRange,
  current: Map<CategoryGroupKey, Map<string, number>>,
  prior: Map<CategoryGroupKey, Map<string, number>>,
): CategoryComparison {
  let currentTotal = 0;
  let priorTotal = 0;

  const groups: CategoryTrendGroup[] = [];
  for (const group of CATEGORY_GROUPS) {
    const cur = current.get(group.key) ?? new Map<string, number>();
    const pri = prior.get(group.key) ?? new Map<string, number>();

    const rows = [...new Set([...cur.keys(), ...pri.keys()])]
      .map((label) =>
        toTrendRow(label, cur.get(label) ?? 0, pri.get(label) ?? 0),
      )
      // A category that billed nothing in either window is noise, not a zero
      // worth a row.
      .filter((r) => r.current !== 0 || r.prior !== 0)
      .sort((a, b) => b.current - a.current);
    if (rows.length === 0) continue;

    const groupCurrent = sumValues(cur);
    const groupPrior = sumValues(pri);
    currentTotal += groupCurrent;
    priorTotal += groupPrior;
    groups.push({
      key: group.key,
      ...toTrendRow(group.label, groupCurrent, groupPrior),
      rows,
    });
  }

  return {
    priorRange: priorWindow,
    total: toTrendRow("All billed revenue", currentTotal, priorTotal),
    groups,
  };
}

// Month-on-month and year-on-year in one payload. Both comparisons share the
// current window, so they can never disagree about it, and the UI can flip
// between them without another round trip.
async function getCategoriesSection(
  range: AnalyticsRange,
): Promise<CategoriesAnalytics> {
  const momWindow = priorRange(range, "mom");
  const yoyWindow = priorRange(range, "yoy");

  const [current, mom, yoy] = await Promise.all([
    billedByCategory(range),
    billedByCategory(momWindow),
    billedByCategory(yoyWindow),
  ]);

  return {
    mom: compareCategories(momWindow, current, mom),
    yoy: compareCategories(yoyWindow, current, yoy),
  };
}

// ---- per-item performance ----

// Invoices whose lines count as trade, over the given window. Shared by every
// query in this part of the file so the leaderboard, the detail view and the
// search can never disagree about which sales exist.
function tradedInvoiceFilter(from: Date, toExclusive: Date) {
  return {
    status: { in: REVENUE_STATUSES },
    issuedAt: { gte: from, lt: toExclusive },
  };
}

// The running totals for one item, before they are rounded into a row.
interface ItemTally {
  unitsSold: number;
  unitsReturned: number;
  grossRevenue: number;
  refunded: number;
  saleLines: number;
  returnLines: number;
}

function emptyTally(): ItemTally {
  return {
    unitsSold: 0,
    unitsReturned: 0,
    grossRevenue: 0,
    refunded: 0,
    saleLines: 0,
    returnLines: 0,
  };
}

// Fold one invoice line into a tally. The sign of the quantity is the whole
// classification: a return is stored as a negative quantity against a positive
// unit price, so both sides are flipped back to positive figures here and the
// caller never has to remember which way round they were.
function addLine(
  tally: ItemTally,
  quantity: number,
  lineTotal: number,
  lineCount = 1,
): void {
  if (quantity < 0) {
    tally.unitsReturned += -quantity;
    tally.refunded += -lineTotal;
    tally.returnLines += lineCount;
  } else {
    tally.unitsSold += quantity;
    tally.grossRevenue += lineTotal;
    tally.saleLines += lineCount;
  }
}

// Turn a tally into the reported row. Quantities keep three decimals because
// stock is decimal (a part-pack sells as 0.25 of a bag); money keeps two.
function toItemRow(
  identity: {
    itemId: number;
    name: string;
    category: string | null;
    unit: string | null;
    barcode: string | null;
  },
  tally: ItemTally,
): ItemPerformanceRow {
  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  return {
    ...identity,
    unitsSold: round3(tally.unitsSold),
    unitsReturned: round3(tally.unitsReturned),
    netUnits: round3(tally.unitsSold - tally.unitsReturned),
    grossRevenue: round2(tally.grossRevenue),
    refunded: round2(tally.refunded),
    netRevenue: round2(tally.grossRevenue - tally.refunded),
    saleLines: tally.saleLines,
    returnLines: tally.returnLines,
    // Nothing sold means there is no base to take a percentage of. Null says so
    // rather than printing a 0% that would read as "nothing came back".
    returnRate:
      tally.unitsSold > 0
        ? round2((tally.unitsReturned / tally.unitsSold) * 100)
        : null,
  };
}

// The leaderboard: the best-selling stock items over the window, ranked on net
// units, i.e. after what came back. Ranking on gross would put an item that
// sold forty and had thirty returned above one that quietly sold thirty-five.
//
// Stock items only. Services have no barcode and no stock position, so they
// belong to the category section rather than here.
async function getItemsSection(range: AnalyticsRange): Promise<ItemsAnalytics> {
  const { from, toExclusive } = rangeBounds(range);

  // Two grouped passes rather than one, split on the sign of the quantity, so
  // sold and returned stay separate figures instead of a single net sum that
  // could not be taken apart again.
  const [sold, returned] = await Promise.all(
    [{ gt: 0 }, { lt: 0 }].map((quantity) =>
      prisma.invoiceLineItem.groupBy({
        by: ["itemId"],
        where: {
          itemId: { not: null },
          // Consumed in the clinic, never sold. It belongs in operating costs,
          // which is where issuing files it, and not in what this item sold.
          isHidden: false,
          quantity,
          invoice: tradedInvoiceFilter(from, toExclusive),
        },
        _sum: { quantity: true, lineTotal: true },
        _count: { _all: true },
      }),
    ),
  );

  const tallies = new Map<number, ItemTally>();
  for (const group of [...sold, ...returned]) {
    if (group.itemId == null) continue;
    const tally = tallies.get(group.itemId) ?? emptyTally();
    addLine(
      tally,
      group._sum.quantity?.toNumber() ?? 0,
      group._sum.lineTotal?.toNumber() ?? 0,
      group._count._all,
    );
    tallies.set(group.itemId, tally);
  }

  const ranked = [...tallies.entries()]
    .sort((a, b) => {
      const netA = a[1].unitsSold - a[1].unitsReturned;
      const netB = b[1].unitsSold - b[1].unitsReturned;
      // Units first, then money as the tie-break: two items that each moved ten
      // units are not equally worth knowing about.
      if (netB !== netA) return netB - netA;
      return (
        b[1].grossRevenue - b[1].refunded - (a[1].grossRevenue - a[1].refunded)
      );
    })
    .slice(0, TOP_ITEMS_LIMIT);

  const items = await prisma.inventoryItem.findMany({
    where: { itemId: { in: ranked.map(([itemId]) => itemId) } },
    select: {
      itemId: true,
      name: true,
      category: true,
      unit: true,
      barcode: true,
    },
  });
  const byId = new Map(items.map((i) => [i.itemId, i]));

  return {
    topSold: ranked.map(([itemId, tally]) =>
      toItemRow(
        byId.get(itemId) ?? {
          itemId,
          // A deleted item still sold, so it keeps its place on the board under
          // an honest placeholder rather than dropping out of the totals.
          name: `Item #${itemId}`,
          category: null,
          unit: null,
          barcode: null,
        },
        tally,
      ),
    ),
  };
}

// Everything one item did over the window, for the detail view under the
// search. Reads the lines themselves rather than grouped sums: the trend, the
// distinct-invoice count and the last sale all need the individual rows, and a
// single item's lines are a small set even over a long range.
export async function getItemPerformance(
  itemId: number,
  range: AnalyticsRange,
): Promise<ItemPerformanceDetail | null> {
  const { from, toExclusive, granularity, buckets } = prepare(range);

  const [item, lines] = await Promise.all([
    prisma.inventoryItem.findUnique({
      where: { itemId },
      select: {
        itemId: true,
        name: true,
        category: true,
        unit: true,
        barcode: true,
        currentStock: true,
        salePrice: true,
      },
    }),
    prisma.invoiceLineItem.findMany({
      // isHidden excluded for the same reason as the tallies above: clinic use
      // is a cost, not a sale, and the two must not be added together.
      where: {
        itemId,
        isHidden: false,
        invoice: tradedInvoiceFilter(from, toExclusive),
      },
      select: {
        quantity: true,
        lineTotal: true,
        invoiceId: true,
        invoice: { select: { issuedAt: true, clientId: true } },
      },
    }),
  ]);
  // Soft-deleted items are still reported: they sold, and hiding the history of
  // a discontinued line is how a report starts disagreeing with the invoices.
  if (!item) return null;

  const tally = emptyTally();
  const soldMap = zeroMap(buckets);
  const returnedMap = zeroMap(buckets);
  const revenueMap = zeroMap(buckets);
  const invoiceIds = new Set<number>();
  const clientIds = new Set<number>();
  let lastSoldAt: Date | null = null;

  for (const line of lines) {
    const quantity = line.quantity.toNumber();
    const lineTotal = line.lineTotal.toNumber();
    addLine(tally, quantity, lineTotal);
    invoiceIds.add(line.invoiceId);
    if (line.invoice.clientId != null) clientIds.add(line.invoice.clientId);

    const issuedAt = line.invoice.issuedAt;
    if (!issuedAt) continue;
    const key = bucketKeyOf(issuedAt, granularity);
    if (quantity < 0) addTo(returnedMap, key, -quantity);
    else {
      addTo(soldMap, key, quantity);
      // Only a sale sets the last-sold date. A refund is the opposite of the
      // thing being asked about.
      if (!lastSoldAt || issuedAt > lastSoldAt) lastSoldAt = issuedAt;
    }
    // Revenue is net per bucket, so a refund shows up in the period it was
    // given, which is the period whose cash it actually changed.
    addTo(revenueMap, key, lineTotal);
  }

  const row = toItemRow(item, tally);

  return {
    ...row,
    currentStock: item.currentStock.toNumber(),
    salePrice: item.salePrice?.toNumber() ?? null,
    invoiceCount: invoiceIds.size,
    clientCount: clientIds.size,
    lastSoldAt: lastSoldAt ? (lastSoldAt as Date).toISOString() : null,
    // What a unit actually fetched, after returns and after whatever discount
    // was typed at the counter. Undefined when the returns cancel the sales out.
    avgUnitPrice:
      row.netUnits !== 0 ? round2(row.netRevenue / row.netUnits) : null,
    trend: buckets.map((b) => ({
      label: b.label,
      sold: Math.round((soldMap.get(b.key) ?? 0) * 1000) / 1000,
      returned: Math.round((returnedMap.get(b.key) ?? 0) * 1000) / 1000,
      revenue: round2(revenueMap.get(b.key) ?? 0),
    })),
  };
}

// Predictive search behind the item picker, matching on name, category and
// barcode. Alternate codes are searched too (see InventoryBarcode): a carton
// scanned at the counter carries the case code, not the item's primary one, so
// a search that only looked at the primary column would fail on exactly the
// codes someone is most likely to scan into the box.
export async function searchAnalyticsItems(
  query: string,
): Promise<ItemSearchResult[]> {
  const q = query.trim();
  const select = {
    itemId: true,
    name: true,
    category: true,
    barcode: true,
    unit: true,
  };

  const items = await prisma.inventoryItem.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { category: { contains: q, mode: "insensitive" as const } },
              { barcode: { contains: q, mode: "insensitive" as const } },
              { barcodes: { some: { gtin: { contains: q } } } },
            ],
          }
        : {}),
    },
    select,
    orderBy: [{ name: "asc" }, { itemId: "asc" }],
    take: ITEM_SEARCH_LIMIT,
  });

  return items;
}

// ---- snapshot sections (not time-boxed) ----

async function getClientsSnapshot(): Promise<ClientsAnalytics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const twelveStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [
    totalActive,
    newThisMonth,
    lapsed,
    totalPatients,
    newRows,
    speciesGroups,
  ] = await Promise.all([
    prisma.client.count({ where: { deletedAt: null } }),
    prisma.client.count({
      where: { deletedAt: null, createdAt: { gte: monthStart } },
    }),
    prisma.client.count({
      where: {
        deletedAt: null,
        bookings: { none: { startsAt: { gte: sixMonthsAgo } } },
      },
    }),
    prisma.patient.count({ where: { deletedAt: null } }),
    prisma.client.findMany({
      where: { deletedAt: null, createdAt: { gte: twelveStart } },
      select: { createdAt: true },
    }),
    prisma.patient.groupBy({
      by: ["species"],
      where: { deletedAt: null },
      _count: { _all: true },
      orderBy: { _count: { species: "desc" } },
    }),
  ]);

  const buckets = buildBuckets(twelveStart, nextMonth, "month");
  const newMap = zeroMap(buckets);
  for (const row of newRows) {
    addTo(newMap, bucketKeyOf(row.createdAt, "month"), 1);
  }
  const newTrend: NamedCount[] = buckets.map((b) => ({
    label: b.label,
    count: newMap.get(b.key) ?? 0,
  }));

  const speciesMix: NamedCount[] = speciesGroups
    .map((g) => ({ label: g.species ?? "Unknown", count: g._count._all }))
    .slice(0, 8);

  return {
    totalActive,
    newThisMonth,
    lapsed,
    totalPatients,
    avgPatientsPerClient:
      totalActive > 0 ? round2(totalPatients / totalActive) : 0,
    newTrend,
    speciesMix,
  };
}

// Stock as it stands right now: levels, valuation and warnings, none of which
// are a flow and so none of which take a date range. What sold is a flow, and
// lives in the items section instead, off the invoice lines rather than off
// stock movements so returns net out of it.
async function getInventorySnapshot(): Promise<InventoryAnalytics> {
  const today = startOfToday();
  const in30Days = new Date(today.getTime() + 30 * DAY_MS);

  const items = await prisma.inventoryItem.findMany({
    where: { deletedAt: null },
    select: {
      itemId: true,
      name: true,
      currentStock: true,
      reorderLevel: true,
      unit: true,
      salePrice: true,
      lastCost: true,
      partnerId: true,
      expiryDate: true,
      tracksExpiry: true,
      // Soonest dated batch still on the shelf. For a tracked item this is the
      // expiry that matters; the column above only speaks for items that are
      // not batched.
      batches: {
        where: { quantity: { gt: 0 }, expiryDate: { not: null } },
        orderBy: { expiryDate: "asc" },
        take: 1,
        select: { expiryDate: true },
      },
    },
  });

  let stockValuation = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let expiringSoonCount = 0;
  for (const it of items) {
    const unitCost = it.lastCost?.toNumber() ?? it.salePrice?.toNumber() ?? 0;
    const stock = it.currentStock.toNumber();
    // Consigned stock was funded by the partner, not the clinic, so it is not
    // the clinic's cash tied up in inventory.
    if (it.partnerId == null) stockValuation += stock * unitCost;
    if (stock <= 0) outOfStockCount += 1;
    if (it.reorderLevel > 0 && stock <= it.reorderLevel) lowStockCount += 1;
    const expiry = it.tracksExpiry
      ? (it.batches[0]?.expiryDate ?? null)
      : it.expiryDate;
    if (
      expiry &&
      expiry.getTime() >= today.getTime() &&
      expiry.getTime() <= in30Days.getTime()
    ) {
      expiringSoonCount += 1;
    }
  }

  const lowStockItems = items
    .filter(
      (it) =>
        it.reorderLevel > 0 && it.currentStock.toNumber() <= it.reorderLevel,
    )
    .sort(
      (a, b) =>
        a.currentStock.toNumber() -
        a.reorderLevel -
        (b.currentStock.toNumber() - b.reorderLevel),
    )
    .slice(0, 10)
    .map((it) => ({
      itemId: it.itemId,
      name: it.name,
      currentStock: it.currentStock.toNumber(),
      reorderLevel: it.reorderLevel,
      unit: it.unit,
    }));

  const outOfStockItems = items
    .filter((it) => it.currentStock.toNumber() <= 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((it) => ({ itemId: it.itemId, name: it.name, unit: it.unit }));

  return {
    totalItems: items.length,
    stockValuation: round2(stockValuation),
    lowStockCount,
    outOfStockCount,
    expiringSoonCount,
    lowStockItems,
    outOfStockItems,
  };
}

// Cash out to suppliers over the range, plus the position as it stands now.
//
// Kept entirely out of the profit calculation on purpose. The clinic recognises
// stock cost as COGS when the item sells, so buying stock moves cash and nothing
// else; folding purchases into profit would charge the same stock twice, once on
// arrival and again on sale. This section sits beside Profitability and answers a
// different question: where the money went, not what was earned.
async function getPurchasesSection(
  range: AnalyticsRange,
): Promise<PurchasesAnalytics> {
  // Every date this section filters on (billedOn, paidOn) is a date-only column,
  // so it needs calendar-date bounds throughout and never the timestamp ones.
  const { granularity, buckets } = prepare(range);
  const { from: dateFrom, toExclusive: dateToExclusive } =
    dateOnlyBounds(range);

  const [billedOrders, payments, allOrders, allPayments] = await Promise.all([
    // An order is billed on the date it reached Received, which is what billedOn
    // records. receivedOn marks the first of possibly several deliveries and
    // would land a part-delivered order in the wrong period.
    prisma.purchaseOrder.findMany({
      where: {
        deletedAt: null,
        status: "Received",
        billedOn: { gte: dateFrom, lt: dateToExclusive },
      },
      select: {
        billedOn: true,
        discountAmount: true,
        shippingAmount: true,
        taxAmount: true,
        supplier: { select: { name: true } },
        lines: { select: { quantityOrdered: true, unitCost: true } },
      },
    }),
    // Cash only. A credit note settles a bill without any money leaving the
    // clinic, so counting it here would report a month as having spent what the
    // supplier actually wrote off. The balance figures below deliberately do NOT
    // make this distinction: a credit reduces what is owed exactly as a payment
    // does.
    prisma.supplierPayment.findMany({
      where: {
        deletedAt: null,
        kind: { not: "Credit" },
        paidOn: { gte: dateFrom, lt: dateToExclusive },
      },
      select: { paidOn: true, amount: true },
    }),
    // Everything, for the as-of-now position: balances are a point in time, so
    // they are not confined to the range.
    prisma.purchaseOrder.findMany({
      where: { deletedAt: null, supplierId: { not: null } },
      select: {
        supplierId: true,
        status: true,
        discountAmount: true,
        shippingAmount: true,
        taxAmount: true,
        lines: { select: { quantityOrdered: true, unitCost: true } },
      },
    }),
    // Every kind, unlike the range-scoped query above: this one builds what is
    // owed, and a credit note settles a bill just as a payment does.
    prisma.supplierPayment.groupBy({
      by: ["supplierId"],
      where: { deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const orderValue = (o: {
    discountAmount: { toNumber(): number } | null;
    shippingAmount: { toNumber(): number } | null;
    taxAmount: { toNumber(): number } | null;
    lines: {
      quantityOrdered: { toNumber(): number };
      unitCost: { toNumber(): number } | null;
    }[];
  }): number => {
    const subtotal = o.lines.reduce(
      (s, l) =>
        l.unitCost
          ? s + l.quantityOrdered.toNumber() * l.unitCost.toNumber()
          : s,
      0,
    );
    return (
      subtotal -
      (o.discountAmount?.toNumber() ?? 0) +
      (o.shippingAmount?.toNumber() ?? 0) +
      (o.taxAmount?.toNumber() ?? 0)
    );
  };

  const billedMap = zeroMap(buckets);
  const paidMap = zeroMap(buckets);
  const bySupplier = new Map<string, number>();
  let periodBilled = 0;

  for (const order of billedOrders) {
    const value = orderValue(order);
    periodBilled += value;
    if (order.billedOn) {
      addTo(billedMap, bucketKeyOf(order.billedOn, granularity), value);
    }
    const name = order.supplier?.name ?? "No supplier";
    bySupplier.set(name, (bySupplier.get(name) ?? 0) + value);
  }

  let periodPaid = 0;
  for (const payment of payments) {
    const amount = payment.amount.toNumber();
    periodPaid += amount;
    addTo(paidMap, bucketKeyOf(payment.paidOn, granularity), amount);
  }

  // Position as of now. Debts and credits are summed separately so a credit on
  // one account cannot cancel a real debt on another.
  const paidBySupplier = new Map(
    allPayments.map((p) => [p.supplierId, p._sum.amount?.toNumber() ?? 0]),
  );
  const billedBySupplier = new Map<number, number>();
  let inProgressNow = 0;
  for (const order of allOrders) {
    if (order.supplierId == null) continue;
    const value = orderValue(order);
    if (order.status === "Received") {
      billedBySupplier.set(
        order.supplierId,
        (billedBySupplier.get(order.supplierId) ?? 0) + value,
      );
    } else if (order.status !== "Cancelled") {
      inProgressNow += value;
    }
  }

  let owedNow = 0;
  let creditNow = 0;
  for (const supplierId of new Set([
    ...billedBySupplier.keys(),
    ...paidBySupplier.keys(),
  ])) {
    const balance =
      (billedBySupplier.get(supplierId) ?? 0) -
      (paidBySupplier.get(supplierId) ?? 0);
    if (balance > 0) owedNow += balance;
    else creditNow += -balance;
  }

  return {
    periodBilled: round2(periodBilled),
    periodPaid: round2(periodPaid),
    periodOrderCount: billedOrders.length,
    owedNow: round2(owedNow),
    creditNow: round2(creditNow),
    inProgressNow: round2(inProgressNow),
    trend: buckets.map((b) => ({
      label: b.label,
      billed: round2(billedMap.get(b.key) ?? 0),
      paid: round2(paidMap.get(b.key) ?? 0),
    })),
    bySupplier: [...bySupplier.entries()]
      .map(([label, value]) => ({ label, value: round2(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };
}

// ---- public API ----

// One time-boxable section for a given range. Used by the /api/analytics route
// when the user changes a section's date range. Profit is gated by the caller
// (costs:read), so it is only reachable for permitted users.
export function getAnalyticsSection(
  section: AnalyticsSection,
  range: AnalyticsRange,
): Promise<
  | RevenueAnalytics
  | ProfitAnalytics
  | PurchasesAnalytics
  | BookingsAnalytics
  | CategoriesAnalytics
  | ItemsAnalytics
> {
  switch (section) {
    case "revenue":
      return getRevenueSection(range);
    case "profit":
      return getProfitSection(range);
    case "purchases":
      return getPurchasesSection(range);
    case "bookings":
      return getBookingsSection(range);
    case "categories":
      return getCategoriesSection(range);
    case "items":
      return getItemsSection(range);
  }
}

// The initial page payload: every section computed once at the default range
// (this month for the boxable sections; snapshots ignore the range). Boxable
// sections can then be re-queried for other ranges via getAnalyticsSection.
export async function getAnalytics(
  options: { includeProfit?: boolean; includePurchases?: boolean } = {},
): Promise<AnalyticsDTO> {
  const range = defaultRange();

  const [
    revenue,
    bookings,
    categories,
    items,
    clients,
    inventory,
    profit,
    purchases,
  ] = await Promise.all([
    getRevenueSection(range),
    getBookingsSection(range),
    getCategoriesSection(range),
    getItemsSection(range),
    getClientsSnapshot(),
    getInventorySnapshot(),
    options.includeProfit ? getProfitSection(range) : null,
    options.includePurchases ? getPurchasesSection(range) : null,
  ]);

  return {
    generatedAt: new Date().toISOString(),
    defaultRange: range,
    revenue,
    clients,
    inventory,
    bookings,
    categories,
    items,
    profit,
    purchases,
  };
}
