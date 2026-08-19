// The clinic's own vocabulary, taken from the Category table in the old Access
// system rather than invented here: these are the words on the shelves. Tab
// order follows this list, so it runs roughly biggest-shelf-first.
export const INVENTORY_CATEGORIES = [
  "Accessories",
  "Food",
  "Treats",
  "Toys",
  "Medication",
  "Supplements",
  "Grooming Supplies",
  "Consumables",
  "Parasite Control",
  "Litter",
  "Other",
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

// Physical size of the printed barcode labels, in millimetres. Change these to
// match your label stock; the print layout and @page rule read from here.
export const LABEL_WIDTH_MM = 40;
export const LABEL_HEIGHT_MM = 30;
