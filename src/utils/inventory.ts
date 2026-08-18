import { INVENTORY_CATEGORIES } from "@/constants/inventory";
import type { InventoryItemDTO } from "@/types/entities";

// Heading used for items saved without a category.
export const UNCATEGORISED = "Uncategorised";

export interface InventoryCategoryGroup {
  category: string;
  items: InventoryItemDTO[];
  lowStockCount: number;
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

// Groups items into the inventory accordions. category is free text in the DB,
// so known categories keep the order defined in constants, any legacy value
// follows alphabetically, and uncategorised items come last. Item order within a
// group is left as received (the API sorts by name).
export function groupItemsByCategory(
  items: InventoryItemDTO[],
): InventoryCategoryGroup[] {
  const groups = new Map<string, InventoryItemDTO[]>();
  for (const item of items) {
    const key = item.category?.trim() || UNCATEGORISED;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  const known: readonly string[] = INVENTORY_CATEGORIES;
  // Sort key: known categories by their configured order, then unknown ones,
  // then uncategorised last.
  const rank = (category: string) => {
    if (category === UNCATEGORISED) return known.length + 1;
    const index = known.indexOf(category);
    return index === -1 ? known.length : index;
  };

  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, groupItems]) => ({
      category,
      items: groupItems,
      lowStockCount: groupItems.filter((i) => i.isLowStock).length,
    }));
}
