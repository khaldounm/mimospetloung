import {
  CURRENCY,
  LBP_CASH_INCREMENT,
  SECONDARY_CURRENCY,
} from "@/constants/clinic";

// Date-only column (@db.Date) -> "YYYY-MM-DD". Prisma returns these as a Date at
// UTC midnight, so slicing the ISO string avoids timezone drift.
export function toDateOnly(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

// Full timestamp -> human-friendly local date + time for display.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Time-only display (e.g. for a day's schedule).
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ISO timestamp -> "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">.
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

// Money value (string from a Decimal column, or number) -> currency display
// using the app-wide CURRENCY (e.g. "$1,234.56"). Single source of truth for
// money formatting across every module. Returns "-" for absent values.
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: CURRENCY.code,
  });
}

// Human-friendly date for display, from a "YYYY-MM-DD" string.
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Account balance in words rather than as a signed number. Positive means the
// client owes the clinic and negative means they are sitting in credit, which
// nobody reads correctly off a bare "-60.00" at a busy counter.
export function formatAccountBalance(
  value: string | number | null | undefined,
): {
  text: string;
  owes: boolean;
} {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (Number.isNaN(n) || n === 0)
    return { text: "Account settled", owes: false };
  if (n > 0) return { text: `Owes ${formatMoney(n)}`, owes: true };
  return { text: `In credit ${formatMoney(Math.abs(n))}`, owes: false };
}

// A USD amount shown in lira, e.g. "LL 8,950,000". LBP has no circulating
// minor unit, so it is always whole numbers. Derived, never stored: the ledger
// is USD and this is a reading of it at a given rate.
export function formatSecondaryMoney(
  value: string | number | null | undefined,
  fxRate: number,
): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n) || !Number.isFinite(fxRate) || fxRate <= 0) return "-";
  const lbp = Math.round(n * fxRate);
  return `${SECONDARY_CURRENCY.symbol} ${lbp.toLocaleString("en-US")}`;
}

// Lira change rounded to something that can physically be handed back: the
// smallest note in circulation is 5,000, so anything finer is a number on a
// screen and nothing else. Rounded to the nearest, not down, and the exact
// figure is shown next to it so the rounding is never hidden.
export function roundLbpCash(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount / LBP_CASH_INCREMENT) * LBP_CASH_INCREMENT;
}

// Today as "YYYY-MM-DD" for an <input type="date">. Built from local date
// parts, not from toISOString, which converts to UTC first and so reports
// yesterday or tomorrow either side of midnight depending on the offset.
export function todayForDateInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Stock quantities are decimal (a part-pack sells as 0.25 of a bag), but almost
// everything moves in whole units, so trailing zeros are dropped rather than
// printing "12.000" on every row.
export function formatQty(value: number, unit?: string | null): string {
  const text = String(Math.round(value * 1000) / 1000);
  return unit ? `${text} ${unit}` : text;
}
