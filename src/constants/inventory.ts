export const INVENTORY_CATEGORIES = [
  "Drugs & Medications",
  "Vaccines",
  "Consumables",
  "Surgical Supplies",
  "Food & Nutrition",
  "Supplements",
  "Parasite Control",
  "Grooming Supplies",
  "Accessories",
  "Litter",
  "Other",
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

// Physical size of the printed barcode labels, in millimetres. Change these to
// match your label stock; the print layout and @page rule read from here.
export const LABEL_WIDTH_MM = 40;
export const LABEL_HEIGHT_MM = 30;
