// Date-range helpers shared by the analytics section builders (server) and the
// DateRangeControl (client). Pure and timezone-local: native date inputs and
// the app's other date handling all work in local time, so we match that.

import type { AnalyticsRange } from "@/types/entities";

const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

// "YYYY-MM-DD" -> local midnight Date. (new Date("YYYY-MM-DD") would parse as
// UTC, which can shift the day, so we build it from parts instead.)
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// An inclusive range as a half-open [from, toExclusive) pair for date queries
// (so the whole of the `to` day is included).
export function rangeBounds(range: AnalyticsRange): {
  from: Date;
  toExclusive: Date;
} {
  const from = parseLocalDate(range.from);
  const to = parseLocalDate(range.to);
  const toExclusive = new Date(
    to.getFullYear(),
    to.getMonth(),
    to.getDate() + 1,
  );
  return { from, toExclusive };
}

// ---- bucketing ----

export type Granularity = "day" | "month";

export interface Bucket {
  key: string;
  label: string;
}

// Short ranges read best as daily bars; longer ones as monthly. The cutoff keeps
// the bar count sane (a quarter of daily bars at most before switching).
export function pickGranularity(from: Date, toExclusive: Date): Granularity {
  const days = Math.round((toExclusive.getTime() - from.getTime()) / DAY_MS);
  return days <= 92 ? "day" : "month";
}

// The bucket key a date falls into, matching buildBuckets' keys.
export function bucketKeyOf(d: Date, granularity: Granularity): string {
  return granularity === "day"
    ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// Ordered buckets spanning [from, toExclusive), oldest first.
export function buildBuckets(
  from: Date,
  toExclusive: Date,
  granularity: Granularity,
): Bucket[] {
  const out: Bucket[] = [];
  const cursor =
    granularity === "day"
      ? new Date(from.getFullYear(), from.getMonth(), from.getDate())
      : new Date(from.getFullYear(), from.getMonth(), 1);

  while (cursor < toExclusive) {
    out.push({
      key: bucketKeyOf(cursor, granularity),
      label:
        granularity === "day"
          ? cursor.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : cursor.toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            }),
    });
    if (granularity === "day") cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

// ---- presets ----

export interface DatePreset {
  id: string;
  label: string;
}

// Lazy shortcuts shown next to the calendar, shortest first.
export const DATE_PRESETS: DatePreset[] = [
  { id: "today", label: "Today" },
  { id: "last-7-days", label: "Last 7 days" },
  { id: "last-30-days", label: "Last 30 days" },
  { id: "this-month", label: "This month" },
  { id: "this-year", label: "This year" },
  { id: "last-12-months", label: "Last 12 months" },
];

export const DEFAULT_PRESET_ID = "this-month";

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

// Resolve a preset id to a concrete range relative to `now`, or null if unknown.
export function resolvePreset(
  id: string,
  now: Date = new Date(),
): AnalyticsRange | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = formatLocalDate(today);
  switch (id) {
    case "today":
      return { from: to, to };
    case "last-7-days":
      return { from: formatLocalDate(addDays(today, -6)), to };
    case "last-30-days":
      return { from: formatLocalDate(addDays(today, -29)), to };
    case "this-month":
      return {
        from: formatLocalDate(
          new Date(today.getFullYear(), today.getMonth(), 1),
        ),
        to,
      };
    case "this-year":
      return { from: formatLocalDate(new Date(today.getFullYear(), 0, 1)), to };
    case "last-12-months":
      return {
        from: formatLocalDate(
          new Date(today.getFullYear(), today.getMonth() - 11, 1),
        ),
        to,
      };
    default:
      return null;
  }
}

// The default range the page seeds boxable sections with.
export function defaultRange(now: Date = new Date()): AnalyticsRange {
  return resolvePreset(DEFAULT_PRESET_ID, now)!;
}

// The preset id whose resolved range equals `range`, or null for a custom range.
// Lets the control highlight the active shortcut.
export function matchPreset(
  range: AnalyticsRange,
  now: Date = new Date(),
): string | null {
  for (const p of DATE_PRESETS) {
    const r = resolvePreset(p.id, now);
    if (r && r.from === range.from && r.to === range.to) return p.id;
  }
  return null;
}

// Human label for a range, e.g. "Jul 1 - Jul 24, 2026" (or a single day).
export function formatRangeLabel(range: AnalyticsRange): string {
  const from = parseLocalDate(range.from);
  const to = parseLocalDate(range.to);
  const full: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  if (range.from === range.to) return to.toLocaleDateString("en-US", full);
  const fromStr = from.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${fromStr} - ${to.toLocaleDateString("en-US", full)}`;
}

// ---- URL round-tripping ----

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Resolve a from/to pair off a URL into a range, or null when either is absent
// or malformed so the caller can fall back to its default. Keeping the range in
// the URL is what lets a chosen period survive a reload and follow a link
// between screens, instead of silently resetting and showing a different period
// under the same heading.
export function rangeFromParams(
  from: string | undefined,
  to: string | undefined,
): AnalyticsRange | null {
  if (!from || !to) return null;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return null;
  if (from > to) return null; // ISO dates sort lexicographically
  return { from, to };
}

// The query string carrying a range, for links and history entries.
export function rangeQuery(range: AnalyticsRange): string {
  return new URLSearchParams({ from: range.from, to: range.to }).toString();
}

// Label for the figures that are a position rather than a flow. A balance is a
// point in time, so it is stated as at the range's last day. Ranges ending today
// are the common case and read better as "today" than as a date the reader has
// to match against a calendar.
export function rangeEndLabel(
  range: AnalyticsRange,
  now: Date = new Date(),
): string {
  if (range.to === formatLocalDate(now)) return "today";
  return parseLocalDate(range.to).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// A short summary for a section header: the matching preset's label when there
// is one, otherwise the explicit date range.
export function rangeSummary(
  range: AnalyticsRange,
  now: Date = new Date(),
): string {
  const id = matchPreset(range, now);
  const preset = id ? DATE_PRESETS.find((p) => p.id === id) : null;
  return preset ? preset.label : formatRangeLabel(range);
}
