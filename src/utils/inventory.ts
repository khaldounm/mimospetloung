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
