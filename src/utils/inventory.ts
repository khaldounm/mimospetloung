import type { InventoryItemDTO } from "@/types/entities";

// Heading used for items saved without a category.
export const UNCATEGORISED = "Uncategorised";

// URL segment for a category. Categories are free text in the database, so the
// slug is derived rather than stored, and resolved back by comparing slugs
// instead of trusting the URL to spell the category exactly.
export function categorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The category whose slug matches, or null when nothing does. */
export function categoryFromSlug(
  slug: string,
  categories: readonly string[],
): string | null {
  const wanted = slug.toLowerCase();
  return categories.find((c) => categorySlug(c) === wanted) ?? null;
}

// Starting quantity offered when an item is pushed into a future order: enough
// to reach twice its reorder level, so it clears the low-stock threshold with
// headroom rather than landing exactly on it. Always at least 1, and always
// editable before the order is placed. Items with no reorder level configured
// have no basis for a suggestion, so they start at 1.
export function suggestedReorderQuantity(item: InventoryItemDTO): number {
  if (item.reorderLevel <= 0) return 1;
  const target = item.reorderLevel * 2;
  return Math.max(1, Math.ceil(target - item.currentStock));
}

// ---- Loose selling ----
//
// A loose-sellable item is a pack that gets broken open and sold by weight or
// volume: a 20kg sack scooped by the kilo, a 1ml vial drawn by the ml. Stock
// stays in packs throughout. Only the entry and the printed line speak the
// loose unit, which is why nothing downstream of the line (stock, COGS, partner
// payouts, analytics) needed changing.

/** Decimal places quantities are stored at. See the precision migration. */
export const QUANTITY_DP = 3;

/** Smallest pack fraction the schema can express, so 0.001 of a pack. */
export const MIN_PACK_QUANTITY = 10 ** -QUANTITY_DP;

export interface LooseConfig {
  unit: string;
  perUnit: number;
  price: number;
}

/**
 * The item's loose setup, or null when it is only sold whole.
 *
 * Numbers are accepted in whatever shape the caller holds them: a Prisma
 * Decimal on the server, a string in a DTO, a number in a form. Anything that
 * does not resolve to a usable pair is treated as "not set up for loose sale"
 * rather than throwing, so a half-written row degrades to whole-pack selling.
 */
export function looseConfigOf(item: {
  looseUnit?: string | null;
  loosePerUnit?: unknown;
  loosePrice?: unknown;
}): LooseConfig | null {
  const { looseUnit, loosePerUnit, loosePrice } = item;
  if (looseUnit == null || loosePerUnit == null || loosePrice == null) {
    return null;
  }
  const perUnit = Number(loosePerUnit);
  const price = Number(loosePrice);
  if (!(perUnit > 0) || !Number.isFinite(price) || price < 0) return null;
  return { unit: looseUnit, perUnit, price };
}

function roundTo(value: number, dp: number): number {
  const f = 10 ** dp;
  // Nudge before rounding so a value that is a hair under a .5 boundary through
  // binary float representation still rounds the way a person reading the
  // decimal would expect.
  return Math.round((value + Number.EPSILON * Math.abs(value)) * f) / f;
}

export interface LooseLine {
  /** Pack quantity to store and to move stock by. */
  quantity: number;
  /** Per-pack price that makes the line total land on the intended charge. */
  unitPrice: number;
  /** What the customer is actually charged. */
  lineTotal: number;
}

/**
 * Turn "2 kg" into the pack quantity and per-pack price a line stores.
 *
 * The charge is always looseQty * loosePrice, computed before any rounding, so
 * the customer pays for what they asked for. The per-pack price is then derived
 * from the rounded pack quantity rather than fixed at price * perUnit: rounding
 * the quantity to 3dp would otherwise drag line_total off the intended charge
 * (500g at $2/kg from a 15kg bag would bill $0.99 instead of $1.00, because
 * line_total is generated as quantity * unit_price). The per-pack figure on a
 * loose line is synthetic anyway, so deriving it costs nothing and keeps the
 * printed total honest.
 *
 * Returns null when the amount is too small to express as a pack fraction.
 */
export function looseLine(
  looseQty: number,
  config: LooseConfig,
): LooseLine | null {
  // Below the minimum the pack fraction rounds up rather than down, so a 10g
  // scoop from a 20kg bag would take 20g off stock. Refuse it instead of
  // booking a quantity the shop did not sell; the dialog offers the minimum.
  if (!(looseQty > 0) || looseQty < minLooseQuantity(config)) return null;

  const quantity = roundTo(looseQty / config.perUnit, QUANTITY_DP);
  if (quantity < MIN_PACK_QUANTITY) return null;

  const lineTotal = roundTo(looseQty * config.price, 2);
  const unitPrice = roundTo(lineTotal / quantity, 2);
  return { quantity, unitPrice, lineTotal };
}

/**
 * Smallest loose amount that can be sold, in loose units: the amount that maps
 * to one unit of the stored pack precision. On a 20kg bag it is 20g, on a 1ml
 * vial it is 0.001ml.
 */
export function minLooseQuantity(config: LooseConfig): number {
  return roundTo(config.perUnit * MIN_PACK_QUANTITY, QUANTITY_DP);
}

/** Round to 2 decimal places, for money derived from a loose figure. */
export function roundMoney(value: number): number {
  return roundTo(value, 2);
}

/**
 * Loose amount as a pack quantity, at the stored precision. Null when the
 * amount is too small to express. Used on the buying side, where there is no
 * customer price to derive, only a quantity.
 */
export function looseToPacks(
  looseQty: number,
  config: LooseConfig,
): number | null {
  if (!(looseQty > 0) || looseQty < minLooseQuantity(config)) return null;
  return roundTo(looseQty / config.perUnit, QUANTITY_DP);
}

/** Pack quantity expressed back in loose units, for display. */
export function packsToLoose(quantity: number, config: LooseConfig): number {
  return roundTo(quantity * config.perUnit, QUANTITY_DP);
}

/**
 * How a line's quantity should read to a person. A loose line shows what the
 * customer asked for ("1.5 kg"); anything else shows the pack count it always
 * did. Screen and PDF both call this so a printed invoice can never disagree
 * with the one on the till.
 */
export function formatLineQuantity(line: {
  quantity: string | number;
  looseQty?: string | number | null;
  looseUnit?: string | null;
}): string {
  if (line.looseQty != null && line.looseUnit) {
    return `${line.looseQty} ${line.looseUnit}`;
  }
  return String(line.quantity);
}
