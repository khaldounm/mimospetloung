import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { CLINIC, CURRENCY, SECONDARY_CURRENCY } from "@/constants/clinic";
import { REGISTER_MAX_DAYS_BACK } from "@/constants/invoice";
import { REGISTER_DRAW_NOTE } from "@/constants/running-cost";
import { getFxRate } from "@/lib/settings";
import type { RegisterCloseInput } from "@/schemas/register";
import type {
  RegisterClosingDTO,
  RegisterCurrencyLine,
  RegisterDayDTO,
  RegisterNonCashLine,
  RegisterPayoutDTO,
} from "@/types/entities";

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);

// The clinic's day, not the server's. Vercel runs in UTC, so a plain
// local-midnight boundary would cut the counter's day at 2 or 3 in the morning
// Beirut time and hand the first hours of a day to the one before it.
function offsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC.timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Intl reports midnight as hour 24 on some runtimes; both mean the same day.
  const hour = get("hour") % 24;
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return (asIfUtc - instant.getTime()) / 60_000;
}

// "YYYY-MM-DD" -> the instant midnight began in the clinic's timezone.
function clinicMidnight(date: string, addDays = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + addDays);
  // Two passes so a day that starts either side of a DST change still lands on
  // the right instant: the first offset is read at the wrong one otherwise.
  const first = new Date(guess - offsetMinutes(new Date(guess)) * 60_000);
  return new Date(guess - offsetMinutes(first) * 60_000);
}

// Today as the clinic reckons it, so the window offered ends on the day the
// counter is actually working, not the server's.
export function clinicToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// The earliest day still open for counting. A register is closed at the end of
// the day it belongs to; a week is the grace period for one that was missed.
export function earliestRegisterDate(now: Date = new Date()): string {
  const [y, m, d] = clinicToday(now).split("-").map(Number);
  const back = new Date(
    Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) - REGISTER_MAX_DAYS_BACK),
  );
  return back.toISOString().slice(0, 10);
}

function emptyLine(currency: string): {
  currency: string;
  taken: Prisma.Decimal;
  refunded: Prisma.Decimal;
} {
  return { currency, taken: D(0), refunded: D(0) };
}

// What the drawer should hold from documents, for one day, together with the
// count already filed against it if there is one.
//
// The document figures are always recomputed and never read off the closing.
// They are what the day looks like NOW, which is what a fresh count has to be
// checked against; the closing carries its own frozen copy for the day it was
// filed. Showing both is what lets an owner see that a day was counted straight
// and that something has moved since.
export async function getRegisterDay(date: string): Promise<RegisterDayDTO> {
  const start = clinicMidnight(date);
  const end = clinicMidnight(date, 1);

  const [payments, fxRate, closing] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: start, lt: end } },
      select: {
        amount: true,
        amountOriginal: true,
        currency: true,
        method: true,
      },
    }),
    getFxRate(),
    getRegisterClosing(date),
  ]);

  // USD and LBP always appear, even on a day neither was taken: the drawer
  // holds both and both have to be counted before the day can be called closed.
  const cash = new Map<string, ReturnType<typeof emptyLine>>([
    [CURRENCY.code, emptyLine(CURRENCY.code)],
    [SECONDARY_CURRENCY.code, emptyLine(SECONDARY_CURRENCY.code)],
  ]);
  const nonCash = new Map<string, { amount: Prisma.Decimal; count: number }>();
  let unspecifiedCount = 0;
  let unspecifiedUsd = D(0);

  for (const p of payments) {
    // A blank method is treated as cash. It is optional in the payment dialog
    // and routinely skipped at a busy counter, and the money it stands for did
    // physically go into the drawer far more often than not. The count of these
    // travels with the figures so the staff can see how much of the day rests
    // on that assumption.
    const isCash = p.method === null || p.method === "Cash";
    if (!isCash) {
      const key = p.method ?? "Unspecified";
      const entry = nonCash.get(key) ?? { amount: D(0), count: 0 };
      entry.amount = entry.amount.plus(p.amount);
      entry.count += 1;
      nonCash.set(key, entry);
      continue;
    }

    if (p.method === null) {
      unspecifiedCount += 1;
      unspecifiedUsd = unspecifiedUsd.plus(p.amount);
    }

    const line = cash.get(p.currency) ?? emptyLine(p.currency);
    cash.set(p.currency, line);
    // A refund is stored as a negative payment, so the sign already says which
    // way the money went. Split here rather than netting blind, because "took
    // 400, gave back 90" is what the staff can check against the receipts.
    if (p.amountOriginal.isNegative()) {
      line.refunded = line.refunded.plus(p.amountOriginal.abs());
    } else {
      line.taken = line.taken.plus(p.amountOriginal);
    }
  }

  const currencies: RegisterCurrencyLine[] = [...cash.values()].map((l) => ({
    currency: l.currency,
    taken: l.taken.toFixed(2),
    refunded: l.refunded.toFixed(2),
    net: l.taken.minus(l.refunded).toFixed(2),
  }));

  const nonCashLines: RegisterNonCashLine[] = [...nonCash.entries()]
    .map(([method, e]) => ({
      method,
      amountUsd: e.amount.toFixed(2),
      count: e.count,
    }))
    .sort((a, b) => a.method.localeCompare(b.method));

  return {
    date,
    fxRate,
    currencies,
    nonCash: nonCashLines,
    unspecifiedCount,
    unspecifiedUsd: unspecifiedUsd.toFixed(2),
    closing,
  };
}

// ---- Closing the day ----

const closingInclude = {
  closer: { select: { firstName: true, lastName: true } },
  payouts: {
    where: { deletedAt: null },
    orderBy: { costId: "asc" },
    select: {
      costId: true,
      category: true,
      description: true,
      amount: true,
      notes: true,
    },
  },
} as const;

type ClosingRow = Prisma.RegisterClosingGetPayload<{
  include: typeof closingInclude;
}>;

// The currency a draw was taken in. running_costs is a USD ledger like the rest
// of the books, so the lira figure would be lost if it were not written down;
// it is kept on the note, which is also what the running-costs list shows.
const DRAW_NOTE = (currency: string, amount: Prisma.Decimal, date: string) =>
  currency === CURRENCY.code
    ? `${REGISTER_DRAW_NOTE} on ${date}`
    : `${REGISTER_DRAW_NOTE} on ${date} (${amount.toFixed(0)} ${currency})`;

// Reads the currency back out of the note above, so reopening a closed day
// shows each draw as it was counted rather than converted.
//
// The note is the only place the original figure lives: running_costs is a USD
// ledger, and the lira amount would otherwise be gone. That makes this a
// best-effort read, not a source of truth. A note edited by hand from the
// running-costs page simply stops matching, and the draw falls back to its USD
// value, which is the figure the books were built on either way.
const DRAW_CURRENCY = /\(([\d,.]+) (\w+)\)$/;

function toPayoutDTO(p: ClosingRow["payouts"][number]): RegisterPayoutDTO {
  const match = p.notes ? DRAW_CURRENCY.exec(p.notes) : null;
  return {
    costId: p.costId,
    category: p.category,
    description: p.description,
    // The USD value is the ledger figure; the original is recovered from the
    // note for a draw that was handed over in lira.
    amount: match ? match[1]!.replace(/,/g, "") : p.amount.toFixed(2),
    currency: match ? match[2]! : CURRENCY.code,
  };
}

function toClosingDTO(c: ClosingRow): RegisterClosingDTO {
  return {
    closingId: c.closingId,
    date: c.businessDate.toISOString().slice(0, 10),
    fxRate: c.fxRate.toNumber(),
    openingUsd: c.openingUsd.toFixed(2),
    openingLbp: c.openingLbp.toFixed(2),
    takenUsd: c.takenUsd.toFixed(2),
    takenLbp: c.takenLbp.toFixed(2),
    refundedUsd: c.refundedUsd.toFixed(2),
    refundedLbp: c.refundedLbp.toFixed(2),
    paidOutUsd: c.paidOutUsd.toFixed(2),
    paidOutLbp: c.paidOutLbp.toFixed(2),
    expectedUsd: c.expectedUsd.toFixed(2),
    expectedLbp: c.expectedLbp.toFixed(2),
    countedUsd: c.countedUsd.toFixed(2),
    countedLbp: c.countedLbp.toFixed(2),
    varianceUsd: c.varianceUsd.toFixed(2),
    notes: c.notes,
    closedByName: c.closer
      ? `${c.closer.firstName} ${c.closer.lastName}`
      : null,
    closedAt: c.closedAt.toISOString(),
    payouts: c.payouts.map(toPayoutDTO),
  };
}

export async function getRegisterClosing(
  date: string,
): Promise<RegisterClosingDTO | null> {
  const row = await prisma.registerClosing.findUnique({
    where: { businessDate: new Date(`${date}T00:00:00.000Z`) },
    include: closingInclude,
  });
  return row ? toClosingDTO(row) : null;
}

// The most recent closings, newest first, for the list an owner reads when they
// get back. Deliberately not paged: the window that can be closed is a week
// wide, so this is a short list by construction.
export async function listRegisterClosings(
  limit = 30,
): Promise<RegisterClosingDTO[]> {
  const rows = await prisma.registerClosing.findMany({
    orderBy: { businessDate: "desc" },
    take: Math.min(Math.max(limit, 1), 90),
    include: closingInclude,
  });
  return rows.map(toClosingDTO);
}

// File the day's count.
//
// Re-closing a day REPLACES the count rather than filing a second one, because
// a receptionist who mistyped what they counted has to be able to fix it and
// the day is one event either way. The draws are deleted and rewritten with it,
// which is why they carry register_closing_id: without it the old ones would
// stay in the month's operating costs and the day would be expensed twice.
//
// Everything the app worked out is frozen onto the row here. It is not derived
// on read, so a payment corrected next week cannot rewrite a day that already
// balanced.
export async function saveRegisterClosing(
  input: RegisterCloseInput,
  closedBy: number | null,
): Promise<RegisterClosingDTO> {
  const day = await getRegisterDay(input.date);
  const fxRate = D(day.fxRate);
  if (fxRate.lte(0)) {
    throw new ApiError(
      400,
      "No exchange rate is set, so the two drawers cannot be reconciled against each other.",
    );
  }

  const lineFor = (currency: string) =>
    day.currencies.find((c) => c.currency === currency);
  const taken = (currency: string) => D(lineFor(currency)?.taken ?? 0);
  const refunded = (currency: string) => D(lineFor(currency)?.refunded ?? 0);

  const paidOut = (currency: string) =>
    input.payouts
      .filter((p) => p.currency === currency)
      .reduce((sum, p) => sum.plus(D(p.amount)), D(0));

  const usd = CURRENCY.code;
  const lbp = SECONDARY_CURRENCY.code;

  // Expected = what was in the drawer at the start, plus what the documents say
  // came in, minus what was handed back out of it. Per currency, because that is
  // how the notes are counted.
  const expected = (currency: string, opening: number) =>
    D(opening)
      .plus(taken(currency))
      .minus(refunded(currency))
      .minus(paidOut(currency))
      .toDecimalPlaces(2);

  const expectedUsd = expected(usd, input.openingUsd);
  const expectedLbp = expected(lbp, input.openingLbp);
  const varianceUsd = D(input.countedUsd)
    .minus(expectedUsd)
    .plus(D(input.countedLbp).minus(expectedLbp).dividedBy(fxRate))
    .toDecimalPlaces(2);

  const businessDate = new Date(`${input.date}T00:00:00.000Z`);
  const figures = {
    fxRate,
    openingUsd: D(input.openingUsd),
    openingLbp: D(input.openingLbp),
    takenUsd: taken(usd),
    takenLbp: taken(lbp),
    refundedUsd: refunded(usd),
    refundedLbp: refunded(lbp),
    paidOutUsd: paidOut(usd),
    paidOutLbp: paidOut(lbp),
    expectedUsd,
    expectedLbp,
    countedUsd: D(input.countedUsd),
    countedLbp: D(input.countedLbp),
    varianceUsd,
    notes: input.notes ?? null,
    closedBy,
  };

  const saved = await prisma.$transaction(async (tx) => {
    const closing = await tx.registerClosing.upsert({
      where: { businessDate },
      create: { businessDate, ...figures },
      update: { ...figures, closedAt: new Date() },
    });

    // Hard delete, not soft. These rows only ever existed as this closing's
    // draws, so a superseded one is a correction and not history: leaving it
    // soft-deleted would clutter the running-costs list with every version of a
    // count somebody retyped.
    await tx.runningCost.deleteMany({
      where: { registerClosingId: closing.closingId },
    });

    if (input.payouts.length > 0) {
      await tx.runningCost.createMany({
        data: input.payouts.map((p) => {
          const original = D(p.amount);
          // The books are in USD. A draw handed over in lira is converted at
          // the day's rate, the same rate the drawer was reconciled at, and the
          // figure actually taken is kept on the note.
          const amountUsd =
            p.currency === usd
              ? original
              : original.dividedBy(fxRate).toDecimalPlaces(2);
          return {
            category: p.category,
            description: p.description,
            amount: amountUsd,
            incurredOn: businessDate,
            notes: DRAW_NOTE(p.currency, original, input.date),
            registerClosingId: closing.closingId,
            createdBy: closedBy,
          };
        }),
      });
    }

    return closing.closingId;
  });

  const dto = await prisma.registerClosing.findUniqueOrThrow({
    where: { closingId: saved },
    include: closingInclude,
  });
  return toClosingDTO(dto);
}
