// Period helpers for the running-costs list, which is addressed one calendar
// month at a time: /running-costs/<year>/<month>/<category>.
//
// Pure and shared by the server (resolving a URL into query bounds) and the
// client (building links, deciding which rail chip is active), so the address
// bar and the data behind it can never disagree.

import {
  ALL_CATEGORIES_SLUG,
  MAX_COST_YEAR,
  MIN_COST_YEAR,
  MONTH_LABELS_SHORT,
  MONTH_SLUGS,
} from "@/constants/running-cost";
import { categorySlug } from "@/utils/slug";

export interface CostPeriod {
  year: number;
  /** 0-11, matching Date's month index. */
  month: number;
}

/** The month slug's index, or -1 when the segment is not a month. */
export function monthIndexFromSlug(slug: string): number {
  return (MONTH_SLUGS as readonly string[]).indexOf(slug.toLowerCase());
}

export function monthSlug(month: number): string {
  return MONTH_SLUGS[month] ?? MONTH_SLUGS[0];
}

export function monthLabel(month: number): string {
  return MONTH_LABELS_SHORT[month] ?? MONTH_LABELS_SHORT[0];
}

/** "August 2026", for headings. */
export function periodLabel(period: CostPeriod): string {
  const name = monthSlug(period.month);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${period.year}`;
}

/**
 * A year/month pair off the URL, or null when either segment is junk. Years are
 * bounded rather than merely numeric so a stray segment cannot build a Date far
 * outside the ledger and quietly return an empty month.
 */
export function parsePeriod(
  yearSegment: string,
  monthSegment: string,
): CostPeriod | null {
  if (!/^\d{4}$/.test(yearSegment)) return null;
  const year = Number(yearSegment);
  if (year < MIN_COST_YEAR || year > MAX_COST_YEAR) return null;
  const month = monthIndexFromSlug(monthSegment);
  if (month === -1) return null;
  return { year, month };
}

/** The URL for a period and category tab. */
export function periodPath(
  period: CostPeriod,
  category: string = ALL_CATEGORIES_SLUG,
): string {
  return `/running-costs/${period.year}/${monthSlug(period.month)}/${category}`;
}

/** The tab segment for a category name. */
export function categoryTabSlug(category: string): string {
  return categorySlug(category) || ALL_CATEGORIES_SLUG;
}

export function currentPeriod(now: Date = new Date()): CostPeriod {
  return { year: now.getFullYear(), month: now.getMonth() };
}

/** The period a "YYYY-MM-DD" cost date falls in, or null when unparseable. */
export function periodOfDate(isoDate: string): CostPeriod | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1 };
}

/**
 * Half-open [from, toExclusive) bounds for the month, built at UTC midnight.
 *
 * incurred_on is a date-only column: Postgres holds no time there and the driver
 * reduces a bound to a calendar date in UTC, so local-midnight bounds slide a
 * day in any timezone ahead of UTC and drop the first of the month. Same reason
 * dateOnlyBounds exists for the analytics ranges.
 */
export function monthBounds(period: CostPeriod): {
  from: Date;
  toExclusive: Date;
} {
  return {
    from: new Date(Date.UTC(period.year, period.month, 1)),
    toExclusive: new Date(Date.UTC(period.year, period.month + 1, 1)),
  };
}

export function samePeriod(a: CostPeriod, b: CostPeriod): boolean {
  return a.year === b.year && a.month === b.month;
}

/**
 * The period and category tab a running-costs URL points at, or null for any
 * other path. Lets the period rail read its own active state off the address
 * bar instead of being re-rendered with it, which is what keeps the rail out of
 * the data fetched when only the month below it changes.
 */
export function periodFromPath(
  pathname: string,
): { period: CostPeriod; category: string } | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "running-costs" || parts.length < 3) return null;
  const period = parsePeriod(parts[1], parts[2]);
  if (!period) return null;
  return { period, category: parts[3] ?? ALL_CATEGORIES_SLUG };
}

/**
 * Where a bare /running-costs (or /running-costs/<year>) should land.
 *
 * The month being worked in is the useful default, so the current month wins
 * whenever it has anything in it. Otherwise fall to the newest month that does,
 * so a clinic that logs costs quarterly opens on its last set of figures rather
 * than on an empty page it has to navigate out of.
 */
export function defaultPeriod(
  months: readonly { year: number; month: number }[],
  year?: number,
  now: Date = new Date(),
): CostPeriod {
  const today = currentPeriod(now);
  const scoped =
    year === undefined ? months : months.filter((m) => m.year === year);

  if (year === undefined || year === today.year) {
    if (scoped.some((m) => samePeriod(m, today))) return today;
  }

  // listCostMonths returns newest first, so the first in scope is the newest.
  const newest = scoped[0];
  if (newest) return { year: newest.year, month: newest.month };

  if (year === undefined || year === today.year) return today;
  return { year, month: year < today.year ? 11 : 0 };
}

/**
 * Where to land after saving a cost, given the page it was saved from.
 *
 * A cost can be dated into any month, so the row often does not belong to the
 * month on screen. Following it means the figure just entered is visible rather
 * than filed somewhere the user has to go looking for. The category tab is kept
 * when the row will actually show under it, and dropped to All when it would
 * not, for the same reason.
 */
export function pathForSavedCost(
  cost: { incurredOn: string; category: string },
  currentPath: string,
): string {
  const period = periodOfDate(cost.incurredOn) ?? currentPeriod();
  const tab = periodFromPath(currentPath)?.category ?? ALL_CATEGORIES_SLUG;
  const visible =
    tab === ALL_CATEGORIES_SLUG || tab === categoryTabSlug(cost.category);
  return periodPath(period, visible ? tab : ALL_CATEGORIES_SLUG);
}
