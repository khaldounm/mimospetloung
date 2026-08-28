import type {
  ItemLineOption,
  ServiceLineOption,
} from "@/components/invoices/LineItemDialog";

// Typing a product name into the scan field, for the things a scanner cannot
// help with: a service, and the large part of the catalogue that has no barcode
// on the box.
//
// Everything here runs against the options the page already shipped, so a
// keystroke costs a filter over an array in memory and never a request. That is
// the whole performance story: the alternative, a search endpoint called as you
// type, puts a round trip between the counter and every character, which at a
// busy counter is exactly where it hurts. The index below is built once per
// mount and the scan is bounded by `limit`, so a catalogue of two thousand
// items costs the same as one of twenty.

export type LineSearchKind = "item" | "service";

export interface LineSearchResult {
  kind: LineSearchKind;
  id: number;
  name: string;
  // Sale price as a string, or null on an item that has none set.
  price: string | null;
  // The line under the name: what is in stock, or that it is a service.
  detail: string;
  // False on an item with no sale price, which cannot go on an invoice until
  // one is set. Shown greyed rather than hidden, so the answer to "why is it not
  // in the list" is on screen.
  selectable: boolean;
}

interface IndexEntry extends LineSearchResult {
  haystack: string;
}

export function buildLineSearchIndex(
  items: ItemLineOption[],
  services: ServiceLineOption[],
): IndexEntry[] {
  const entries: IndexEntry[] = [];

  for (const s of services) {
    entries.push({
      kind: "service",
      id: s.serviceId,
      name: s.name,
      price: s.price,
      detail: "Service",
      selectable: true,
      haystack: s.name.toLowerCase(),
    });
  }

  for (const i of items) {
    entries.push({
      kind: "item",
      id: i.itemId,
      name: i.name,
      price: i.salePrice,
      detail:
        `${i.currentStock}${i.unit ? ` ${i.unit}` : ""} in stock` +
        (i.salePrice == null ? ", no price set" : ""),
      selectable: i.salePrice != null,
      haystack: i.name.toLowerCase(),
    });
  }

  return entries;
}

// Every term has to appear somewhere in the name, in any order, so "dog dry"
// finds "Dry food, dog". Ranked so a name that STARTS with what was typed comes
// first: at a counter the first result is the one that gets picked, and having
// to read past four near-misses to reach the obvious one is worse than no list.
function scoreOf(haystack: string, query: string): number {
  if (haystack.startsWith(query)) return 0;
  if (haystack.includes(` ${query}`)) return 1;
  return 2;
}

export function searchLines(
  index: IndexEntry[],
  query: string,
  limit: number,
): LineSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);

  const hits: { entry: IndexEntry; score: number }[] = [];
  for (const entry of index) {
    if (!terms.every((t) => entry.haystack.includes(t))) continue;
    hits.push({ entry, score: scoreOf(entry.haystack, q) });
    // Stop early once there is comfortably more than one screenful of matches
    // to rank. A one-letter query would otherwise sort the whole catalogue on
    // every keystroke to show eight rows.
    if (hits.length >= limit * 8) break;
  }

  hits.sort(
    (a, b) =>
      a.score - b.score ||
      a.entry.name.length - b.entry.name.length ||
      a.entry.name.localeCompare(b.entry.name),
  );

  return hits.slice(0, limit).map((h) => h.entry);
}
