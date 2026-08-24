import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CLINIC, CURRENCY, SECONDARY_CURRENCY } from "@/constants/clinic";
import { REGISTER_MAX_DAYS_BACK } from "@/constants/invoice";
import { getFxRate } from "@/lib/settings";
import type {
  RegisterCurrencyLine,
  RegisterDayDTO,
  RegisterNonCashLine,
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

// What the drawer should hold from documents, for one day. Read-only: closing
// the register is a counting exercise on the counter's side, and nothing here
// is written back.
export async function getRegisterDay(date: string): Promise<RegisterDayDTO> {
  const start = clinicMidnight(date);
  const end = clinicMidnight(date, 1);

  const [payments, fxRate] = await Promise.all([
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
  };
}
