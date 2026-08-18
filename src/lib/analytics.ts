import { prisma } from "@/lib/prisma";
import { BOOKING_STATUSES } from "@/types/enums";
import {
  buildBuckets,
  bucketKeyOf,
  defaultRange,
  pickGranularity,
  rangeBounds,
  type Bucket,
  type Granularity,
} from "@/utils/date-range";
import type { AnalyticsSection } from "@/schemas/analytics";
import type {
  AnalyticsDTO,
  AnalyticsRange,
  BookingsAnalytics,
  ClientsAnalytics,
  InventoryAnalytics,
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
      where: { deletedAt: null, incurredOn: { gte: from, lt: toExclusive } },
    }),
    prisma.runningCost.findMany({
      where: { deletedAt: null, incurredOn: { gte: from, lt: toExclusive } },
      select: { incurredOn: true, amount: true },
    }),
    prisma.runningCost.groupBy({
      by: ["category"],
      where: { deletedAt: null, incurredOn: { gte: from, lt: toExclusive } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 8,
    }),
    // Sold movements carry the frozen unit cost; COGS = |qty| * unitCost. A
    // void writes an Adjusted movement (referenceType "invoice") carrying the
    // same frozen cost with a positive quantity, so the signed sum below nets
    // a voided sale back out. Consigned items (partnerId set) are excluded here
    // and counted as partner payouts instead, so their cost is not double-counted.
    prisma.inventoryTransaction.findMany({
      where: {
        partnerId: null,
        unitCost: { not: null },
        performedAt: { gte: from, lt: toExclusive },
        OR: [{ type: "Sold" }, { type: "Adjusted", referenceType: "invoice" }],
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

async function getInventorySnapshot(): Promise<InventoryAnalytics> {
  const today = startOfToday();
  const in30Days = new Date(today.getTime() + 30 * DAY_MS);
  const ninetyDaysAgo = new Date(today.getTime() - 90 * DAY_MS);

  const [items, soldGroups] = await Promise.all([
    prisma.inventoryItem.findMany({
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
      },
    }),
    prisma.inventoryTransaction.groupBy({
      by: ["itemId"],
      where: { type: "Sold", performedAt: { gte: ninetyDaysAgo } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "asc" } },
      take: 8,
    }),
  ]);

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
    if (
      it.expiryDate &&
      it.expiryDate.getTime() >= today.getTime() &&
      it.expiryDate.getTime() <= in30Days.getTime()
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

  const itemIds = soldGroups.map((g) => g.itemId);
  const soldItems = await prisma.inventoryItem.findMany({
    where: { itemId: { in: itemIds } },
    select: { itemId: true, name: true },
  });
  const itemNames = new Map(soldItems.map((i) => [i.itemId, i.name]));
  const topConsumed = soldGroups.map((g) => ({
    label: itemNames.get(g.itemId) ?? `Item #${g.itemId}`,
    // Sold movements are stored as negative quantities; flip to a positive count.
    value: Math.abs(g._sum.quantity?.toNumber() ?? 0),
  }));

  return {
    totalItems: items.length,
    stockValuation: round2(stockValuation),
    lowStockCount,
    outOfStockCount,
    expiringSoonCount,
    lowStockItems,
    outOfStockItems,
    topConsumed,
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
  const { from, toExclusive, granularity, buckets } = prepare(range);

  const [billedOrders, payments, allOrders, allPayments] = await Promise.all([
    // An order is billed on the date it reached Received, which is what billedOn
    // records. receivedOn marks the first of possibly several deliveries and
    // would land a part-delivered order in the wrong period.
    prisma.purchaseOrder.findMany({
      where: {
        deletedAt: null,
        status: "Received",
        billedOn: { gte: from, lt: toExclusive },
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
    prisma.supplierPayment.findMany({
      where: { deletedAt: null, paidOn: { gte: from, lt: toExclusive } },
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
  RevenueAnalytics | ProfitAnalytics | PurchasesAnalytics | BookingsAnalytics
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
  }
}

// The initial page payload: every section computed once at the default range
// (this month for the boxable sections; snapshots ignore the range). Boxable
// sections can then be re-queried for other ranges via getAnalyticsSection.
export async function getAnalytics(
  options: { includeProfit?: boolean; includePurchases?: boolean } = {},
): Promise<AnalyticsDTO> {
  const range = defaultRange();

  const [revenue, bookings, clients, inventory, profit, purchases] =
    await Promise.all([
      getRevenueSection(range),
      getBookingsSection(range),
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
    profit,
    purchases,
  };
}
