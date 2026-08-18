// Running-cost (operating expense) categories and the items typically logged
// under each. These are SUGGESTIONS only: the cost form lets the user pick from
// these or type a new category / item, so the list can grow over time without a
// code change. Grouping by category is what the analytics breakdown keys on.

export const RUNNING_COST_CATEGORIES = [
  "Utilities",
  "Rent",
  "Salaries",
  "Perishable medication",
  "Ops items",
  "Other",
] as const;

export type RunningCostCategory = (typeof RUNNING_COST_CATEGORIES)[number];

// Suggested item names per category, surfaced as autocomplete options. Free
// text is still allowed so new items can be added on the fly.
export const RUNNING_COST_ITEM_SUGGESTIONS: Record<string, string[]> = {
  Utilities: ["Electricity", "Water", "Internet"],
  Rent: ["Rent"],
  Salaries: ["Salaries"],
  "Perishable medication": ["Betadine", "Iodine", "Alcohol"],
  "Ops items": ["Gloves", "Pads", "Syringes"],
  Other: [],
};
