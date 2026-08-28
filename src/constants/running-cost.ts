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
  // Equipment the clinic is paying for: an x-ray, an MRI, a blood test
  // machine. Kept apart from Ops items because these are lumpy and one month's
  // figure says nothing about the run rate, so a reader who cannot separate
  // them reads a machine purchase as the clinic suddenly bleeding money.
  "Hardware",
  "Other",
  // Everything imported from the old Access system. Its own expense types were
  // a mix of departments (vet, grooming, pet shop) and cost kinds, with most of
  // the detail in free-text Arabic, so re-filing it into the categories above
  // would mean guessing. One honest bucket with correct dates instead: the
  // totals and the trend are right, and staff can re-file individual rows in
  // the app whenever they care to.
  "Legacy",
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
  Hardware: ["X-ray", "MRI", "Blood test machine"],
  Other: [],
  Legacy: [],
};

// Where a hidden invoice line files itself when the invoice is issued. Gloves,
// pads and syringes are already the suggested items under this category, which
// is exactly what a hidden line is for.
export const CLINIC_USE_COST_CATEGORY = "Ops items";

// What the register's cash draws are called on the running-costs list, so a
// figure that appeared without anyone typing it says where it came from.
export const REGISTER_DRAW_NOTE = "Drawn from the register";

// ---- Period navigation ----
//
// The list is one calendar month at a time, addressed by URL:
// /running-costs/<year>/<month>/<category>. Month slugs are the full lowercase
// names so the address stays readable, and the category segment is a slug of
// the free-text category (see @/utils/slug) with ALL_CATEGORIES_SLUG meaning
// "no category filter".

export const MONTH_SLUGS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

// Short labels for the month rail, same order as MONTH_SLUGS.
export const MONTH_LABELS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// Reserved category segment: the tab that applies no category filter. A real
// category slugging to "all" would collide, which is why it is spelled out here
// rather than left implicit.
export const ALL_CATEGORIES_SLUG = "all";

// Guard rails for a year taken off the URL. Wide enough for any real ledger,
// narrow enough that a junk segment 404s instead of building a date from it.
export const MIN_COST_YEAR = 2000;
export const MAX_COST_YEAR = 2100;
