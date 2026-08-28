// Grouping for the category comparison section. Invoice lines carry either an
// inventory item or a service, and each of those already has a free-text
// category, so nothing new is stored: this file only decides how those
// categories roll up on the report.

// The one Service.category the clinic reads as a separate business line rather
// than as veterinary work. Every other service category rolls up under vet.
export const GROOMING_SERVICE_CATEGORY = "Grooming";

// Service categories that are not a business line at all. Adjustment holds the
// counter's Discount line and the legacy import's "Unknown legacy product",
// both of which carry a negative or unattributable amount: folding them into
// vet work would understate what the vets actually billed. They are reported
// under Other so the group totals still add up to billed revenue.
export const NON_TRADE_SERVICE_CATEGORIES = new Set(["Adjustment"]);

// Shown for a line whose item or service has no category set. Named rather than
// dropped, so the group totals still add up to billed revenue.
export const UNCATEGORISED_LABEL = "Uncategorised";

// The label for a free-text invoice line: no item, no service, so there is no
// category to take. Common on legacy data.
export const AD_HOC_LABEL = "Ad-hoc lines";

// Display order on the report, biggest business line first.
export const CATEGORY_GROUPS = [
  { key: "products", label: "Products" },
  { key: "vet", label: "Vet services" },
  { key: "grooming", label: "Grooming services" },
  { key: "other", label: "Other" },
] as const;

export type CategoryGroupKey = (typeof CATEGORY_GROUPS)[number]["key"];

// ---- By-item performance ----

// How many items the leaderboard shows when the section is opened. Ten is what
// the counter asked for: enough to see the movers, short enough to read without
// scrolling.
export const TOP_ITEMS_LIMIT = 10;

// Cap on the predictive item search. The picker is a keyboard search, not a
// browse: past a couple of dozen hits the answer is "type more", not "scroll".
export const ITEM_SEARCH_LIMIT = 20;
