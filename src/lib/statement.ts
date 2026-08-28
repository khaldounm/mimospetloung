import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CLINIC, CURRENCY } from "@/constants/clinic";
import { AGING_BUCKETS } from "@/constants/statement";
import { dateOnlyBounds } from "@/utils/date-range";
import { toDateOnly } from "@/utils/format";
import type {
  AnalyticsRange,
  StatementDTO,
  StatementLineDTO,
  StatementSupplierDTO,
  StatementTotalsDTO,
} from "@/types/entities";

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);
const DAY_MS = 24 * 60 * 60 * 1000;

// A supplier statement in the accounts-payable sense: opening balance, the
// charges and payments that moved it over the period, and the closing balance it
// arrived at. The identity
//
//   opening + billed - paid = closing
//
// holds by construction rather than by being computed twice: opening is the
// balance up to the day before the period, closing is the balance up to its last
// day, and both come from the same two running sums. That is what makes the
// statement reconcilable against a supplier's own records.
//
// A charge is recognised on billedOn, the date an order reached Received. Not
// receivedOn, which marks the first delivery of what may be several: using it
// would put a liability in the period the first box arrived rather than the one
// the order was completed in, a cut-off error.

// ---- Row shapes ----

const chargeSelect = {
  orderId: true,
  supplierId: true,
  reference: true,
  billedOn: true,
  discountAmount: true,
  shippingAmount: true,
  taxAmount: true,
  lines: { select: { quantityOrdered: true, unitCost: true } },
} as const;

type ChargeRow = Prisma.PurchaseOrderGetPayload<{
  select: typeof chargeSelect;
}>;

const paymentSelect = {
  paymentId: true,
  supplierId: true,
  orderId: true,
  amount: true,
  paidOn: true,
  kind: true,
  method: true,
  reference: true,
} as const;

// The value of an order, matching what the order page shows: lines at the
// quantity ordered, less discount, plus delivery and VAT.
function chargeValue(order: ChargeRow): Prisma.Decimal {
  const subtotal = order.lines.reduce(
    (sum, l) =>
      l.unitCost ? sum.plus(l.quantityOrdered.times(l.unitCost)) : sum,
    D(0),
  );
  return subtotal
    .minus(order.discountAmount ?? 0)
    .plus(order.shippingAmount ?? 0)
    .plus(order.taxAmount ?? 0);
}

function orderLabel(order: { orderId: number; reference: string | null }) {
  return order.reference || `Order #${order.orderId}`;
}

// ---- Aging ----

// Age the closing balance by applying payments to charges oldest first, the
// standard accounts-payable convention. A payment linked to a specific order is
// not treated as ring-fenced: on an account with a running balance, cash settles
// the oldest debt, and that is how a supplier's own ledger will read it.
//
// Because every charge is consumed in date order until the money runs out, the
// buckets always sum back to the closing balance.
function ageOutstanding(
  charges: { billedOn: Date; amount: Prisma.Decimal }[],
  paidToDate: Prisma.Decimal,
  asAt: Date,
): Record<string, Prisma.Decimal> {
  const buckets: Record<string, Prisma.Decimal> = {};
  for (const bucket of AGING_BUCKETS) buckets[bucket.id] = D(0);

  let unapplied = paidToDate;
  const oldestFirst = [...charges].sort(
    (a, b) => a.billedOn.getTime() - b.billedOn.getTime(),
  );

  for (const charge of oldestFirst) {
    let outstanding = charge.amount;
    if (unapplied.greaterThan(0)) {
      const applied = unapplied.greaterThanOrEqualTo(outstanding)
        ? outstanding
        : unapplied;
      outstanding = outstanding.minus(applied);
      unapplied = unapplied.minus(applied);
    }
    if (outstanding.lessThanOrEqualTo(0)) continue;

    const ageDays = Math.floor(
      (asAt.getTime() - charge.billedOn.getTime()) / DAY_MS,
    );
    const bucket =
      AGING_BUCKETS.find(
        (b) => ageDays <= (b.maxDays ?? Number.POSITIVE_INFINITY),
      ) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1];
    buckets[bucket.id] = buckets[bucket.id].plus(outstanding);
  }

  return buckets;
}

function agingToStrings(
  buckets: Record<string, Prisma.Decimal>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(buckets).map(([id, value]) => [id, value.toFixed(2)]),
  );
}

// ---- Build ----

export async function getStatement(
  range: AnalyticsRange,
): Promise<StatementDTO> {
  // Every date this report touches (billedOn, paidOn, asOfDate) is a date-only
  // column, so it works entirely in calendar-date bounds and never the timestamp
  // ones. `from` below splits opening balances from in-period activity, and a
  // local-midnight bound would misfile a charge dated on the first day of the
  // period in any timezone behind UTC.
  const { from, toExclusive: dateToExclusive } = dateOnlyBounds(range);
  // Last day of the period, which is what balances and aging are stated as at.
  // Stepped back from the calendar bound, not the timestamp one: the label is
  // rendered by taking the UTC date off this value, and the charges it is aged
  // against are date-only columns read back at UTC midnight. Deriving it from
  // local midnight put both a day out east of UTC, so a period ending today was
  // headed "as at yesterday" and every charge aged a day young.
  const asAt = new Date(dateToExclusive.getTime() - DAY_MS);

  const [suppliers, charges, payments, openingEntries] = await Promise.all([
    prisma.supplier.findMany({
      where: { deletedAt: null },
      select: { supplierId: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Everything billed up to the end of the period. Earlier charges are needed
    // for the opening balance, so the query is not confined to the range.
    prisma.purchaseOrder.findMany({
      where: {
        deletedAt: null,
        supplierId: { not: null },
        status: "Received",
        billedOn: { not: null, lt: dateToExclusive },
      },
      select: chargeSelect,
    }),
    prisma.supplierPayment.findMany({
      where: { deletedAt: null, paidOn: { lt: dateToExclusive } },
      select: paymentSelect,
    }),
    // Balances carried in from the old Access system. Treated as an ordinary
    // dated charge so they fall into the opening figure or onto a line by the
    // same rule as everything else, and so `ties` stays meaningful: before
    // these existed, the five suppliers holding one never reconciled.
    prisma.openingBalance.findMany({
      where: { supplierId: { not: null }, asOfDate: { lt: dateToExclusive } },
      select: { supplierId: true, amount: true, asOfDate: true },
    }),
  ]);

  const bySupplier = new Map<number, StatementSupplierDTO>();
  const chargesBySupplier = new Map<
    number,
    { billedOn: Date; amount: Prisma.Decimal }[]
  >();

  // Seed a row per supplier so one with an opening balance and no activity in
  // the period still appears, which an auditor will expect.
  for (const s of suppliers) {
    bySupplier.set(s.supplierId, {
      supplierId: s.supplierId,
      supplierName: s.name,
      openingBalance: "0.00",
      billed: "0.00",
      paid: "0.00",
      credited: "0.00",
      closingBalance: "0.00",
      ties: true,
      aging: agingToStrings(
        Object.fromEntries(AGING_BUCKETS.map((b) => [b.id, D(0)])),
      ),
      lines: [],
    });
    chargesBySupplier.set(s.supplierId, []);
  }

  // Running sums, split at the period boundary.
  const opening = new Map<number, Prisma.Decimal>();
  const billed = new Map<number, Prisma.Decimal>();
  // Settled in the period, split by how. Both come off the balance; only one of
  // them was money, and the statement has to be able to say which.
  const paid = new Map<number, Prisma.Decimal>();
  const credited = new Map<number, Prisma.Decimal>();
  const paidToDate = new Map<number, Prisma.Decimal>();
  const add = (m: Map<number, Prisma.Decimal>, k: number, v: Prisma.Decimal) =>
    m.set(k, (m.get(k) ?? D(0)).plus(v));

  const inPeriodLines = new Map<
    number,
    { date: Date; line: Omit<StatementLineDTO, "balance"> }[]
  >();
  const pushLine = (
    supplierId: number,
    date: Date,
    line: Omit<StatementLineDTO, "balance">,
  ) => {
    const bucket = inPeriodLines.get(supplierId);
    if (bucket) bucket.push({ date, line });
    else inPeriodLines.set(supplierId, [{ date, line }]);
  };

  for (const order of charges) {
    if (order.supplierId == null || order.billedOn == null) continue;
    const supplierId = order.supplierId;
    if (!bySupplier.has(supplierId)) continue; // supplier soft-deleted
    const amount = chargeValue(order);

    chargesBySupplier
      .get(supplierId)!
      .push({ billedOn: order.billedOn, amount });

    if (order.billedOn < from) {
      add(opening, supplierId, amount);
    } else {
      add(billed, supplierId, amount);
      pushLine(supplierId, order.billedOn, {
        kind: "order",
        date: toDateOnly(order.billedOn) ?? "",
        reference: orderLabel(order),
        description: "Purchase order received",
        charge: amount.toFixed(2),
        payment: "0.00",
        href: `/orders/${order.orderId}`,
      });
    }
  }

  for (const entry of openingEntries) {
    const supplierId = entry.supplierId;
    if (supplierId == null || !bySupplier.has(supplierId)) continue;

    // It ages like any other unpaid charge, oldest first, or the aging columns
    // stop summing to the closing balance for exactly the suppliers that have
    // been owed the longest.
    chargesBySupplier
      .get(supplierId)!
      .push({ billedOn: entry.asOfDate, amount: entry.amount });

    if (entry.asOfDate < from) {
      add(opening, supplierId, entry.amount);
    } else {
      add(billed, supplierId, entry.amount);
      pushLine(supplierId, entry.asOfDate, {
        kind: "opening",
        date: toDateOnly(entry.asOfDate) ?? "",
        reference: "Opening balance",
        description: "Balance the account was opened with",
        charge: entry.amount.toFixed(2),
        payment: "0.00",
        href: null,
      });
    }
  }

  for (const payment of payments) {
    const supplierId = payment.supplierId;
    if (!bySupplier.has(supplierId)) continue;
    add(paidToDate, supplierId, payment.amount);

    if (payment.paidOn < from) {
      add(opening, supplierId, payment.amount.negated());
    } else {
      // A credit note settles the account exactly as cash does, so it belongs
      // on the payment side of the ledger and the balance arithmetic needs no
      // special case. It is tallied separately alongside, because a reader
      // reconciling this against their bank statement has to be able to tell
      // which of it was money.
      const isCredit = payment.kind === "Credit";
      add(isCredit ? credited : paid, supplierId, payment.amount);
      const label = isCredit ? "Credit note" : "Payment";
      pushLine(supplierId, payment.paidOn, {
        kind: "payment",
        date: toDateOnly(payment.paidOn) ?? "",
        reference: payment.reference || (payment.method ?? label),
        description: payment.orderId
          ? `${label} against order #${payment.orderId}`
          : `${label} on account`,
        charge: "0.00",
        payment: payment.amount.toFixed(2),
        href: payment.orderId ? `/orders/${payment.orderId}` : null,
      });
    }
  }

  // Assemble each supplier, running the balance forward through its lines so
  // every row shows what the account stood at immediately after it.
  for (const [supplierId, row] of bySupplier) {
    const open = opening.get(supplierId) ?? D(0);
    const charged = billed.get(supplierId) ?? D(0);
    const cash = paid.get(supplierId) ?? D(0);
    const credit = credited.get(supplierId) ?? D(0);
    const settled = cash.plus(credit);
    const closing = open.plus(charged).minus(settled);

    const sorted = (inPeriodLines.get(supplierId) ?? []).sort((a, b) => {
      const byDate = a.date.getTime() - b.date.getTime();
      // Charges before payments on the same day: the debt has to exist before
      // it can be settled, and a statement that shows otherwise looks wrong.
      // Brought-forward leads either of them: it is what the account already
      // stood at before the day began.
      if (byDate !== 0) return byDate;
      const rank = (k: StatementLineDTO["kind"]) =>
        k === "opening" ? 0 : k === "order" ? 1 : 2;
      return rank(a.line.kind) - rank(b.line.kind);
    });

    let running = open;
    row.lines = sorted.map(({ line }) => {
      running = running.plus(line.charge).minus(line.payment);
      return { ...line, balance: running.toFixed(2) };
    });

    row.openingBalance = open.toFixed(2);
    row.billed = charged.toFixed(2);
    row.paid = cash.toFixed(2);
    row.credited = credit.toFixed(2);
    row.closingBalance = closing.toFixed(2);
    // The running balance must land exactly on the closing figure. If it does
    // not, a line was dropped, and the statement says so rather than hiding it.
    row.ties = running.equals(closing);
    row.aging = agingToStrings(
      ageOutstanding(
        chargesBySupplier.get(supplierId) ?? [],
        paidToDate.get(supplierId) ?? D(0),
        asAt,
      ),
    );
  }

  // Suppliers with nothing at all in or before the period are noise on a
  // statement, so drop them. One with an opening balance stays even if quiet.
  const rows = [...bySupplier.values()].filter(
    (r) =>
      Number(r.openingBalance) !== 0 ||
      Number(r.billed) !== 0 ||
      Number(r.paid) !== 0 ||
      Number(r.credited) !== 0,
  );

  const sumOf = (pick: (r: StatementSupplierDTO) => string) =>
    rows.reduce((sum, r) => sum.plus(pick(r)), D(0));

  const totalOpening = sumOf((r) => r.openingBalance);
  const totalBilled = sumOf((r) => r.billed);
  const totalPaid = sumOf((r) => r.paid);
  const totalCredited = sumOf((r) => r.credited);
  const totalClosing = sumOf((r) => r.closingBalance);

  const totals: StatementTotalsDTO = {
    openingBalance: totalOpening.toFixed(2),
    billed: totalBilled.toFixed(2),
    paid: totalPaid.toFixed(2),
    credited: totalCredited.toFixed(2),
    closingBalance: totalClosing.toFixed(2),
    ties:
      totalOpening
        .plus(totalBilled)
        .minus(totalPaid)
        .minus(totalCredited)
        .equals(totalClosing) && rows.every((r) => r.ties),
    aging: Object.fromEntries(
      AGING_BUCKETS.map((b) => [
        b.id,
        rows.reduce((sum, r) => sum.plus(r.aging[b.id] ?? 0), D(0)).toFixed(2),
      ]),
    ),
    supplierCount: rows.length,
  };

  return {
    clinicName: CLINIC.name,
    currency: CURRENCY.code,
    range,
    asAt: toDateOnly(asAt) ?? range.to,
    generatedAt: new Date().toISOString(),
    suppliers: rows,
    totals,
  };
}
