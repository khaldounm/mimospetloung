// Configuration for the one-off migration from the clinic's old Microsoft Access
// system (GT_Data<YY>.mdb) into this app. See src/lib/legacy-import/.
//
// The .mdb holds real client PII, so every intermediate file is written to a
// scratch directory OUTSIDE the repo. Never point LEGACY_WORK_DIR inside it.

// Source tables that carry real data. The file has ~170 tables; the rest are
// vendor scaffolding (temp tables, report caches, "Paste Errors", Table1).
export const LEGACY_TABLES = [
  "CustomerWholesale",
  "Products",
  "CustInvoices",
  "CustInvoiceDetails",
  "Payments",
  "Invoices",
  "Invoice Details",
  "Suppliers",
  "SupPayments",
] as const;

export type LegacyTable = (typeof LEGACY_TABLES)[number];

// Postgres-safe staging table name for each source table.
export function stagingTableName(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export const STAGING_SCHEMA = "staging";

// The walk-in counter account. 2,398 invoices sit on it. It is not a person and
// must not become a Client row.
export const LEGACY_WALKIN_CUSTOMER_ID = 1;

// Titles typed into the name field with no separating space ("Dr.Rana Merhej").
// The trailing \. is load-bearing: without it this also eats the real client
// name "Engrid Saad".
export const LEGACY_TITLE_PREFIX = /^(dr|mr|mrs|miss|eng|sheikh|messrs)\.\s*/i;

// Pet names were typed into the client "notes" box with no house style.
export const PET_NAME_SEPARATORS = /[\n\r/&,]|\s+-\s+/;

// Words that appear where a pet name should be. These describe the animal
// instead of naming it, so the pet is imported unnamed and flagged.
export const PET_NON_NAMES = new Set([
  "cat",
  "cats",
  "dog",
  "dogs",
  "kitten",
  "kittens",
  "puppy",
  "puppies",
  "bird",
  "birds",
  "rabbit",
  "turtle",
  "hamster",
  "big cats",
  "grey",
  "bichon",
  "persian",
  "shirazi",
  "maltese",
  "husky",
  "poodle",
]);

// Classifying the old product list into clinic services versus retail stock is
// done in three passes, because a single keyword list gets it badly wrong:
// "snap cat chicken pate 400g" is food, not a SNAP test, and "crispy crunch
// dental cat 60g" is a chew, not dental surgery.

// 1. Things only ever done to an animal. These win outright, even when the name
//    carries a weight, because that weight is the animal's ("castration female
//    dog 10-20kg") rather than a pack size.
// Always retail regardless of what else matches: a travel kennel is not kennel
// cough, and a brush is not a grooming appointment.
export const LEGACY_SERVICE_EXCLUSIONS =
  /kennel|carrier|cage|brush|slicker|comb|powder|shampoo|towel|bone\b|treat/i;

export const LEGACY_STRONG_SERVICE: ReadonlyArray<[string, RegExp]> = [
  ["Surgery", /castrat|spay|neuter|surger|operation|caesar|suture/i],
  ["Consultation", /\bvisit\b|consult|checkup|check up/i],
  ["Diagnostics", /\bx-?ray\b|\becho\b|ultrasound/i],
  ["Grooming", /\bshower\b|nail trim|clipping/i],
];

// 2. A pack size means it is something sold off a shelf: 400g, 1.5kg, 750ml,
//    6.2cm. Checked only after the rules above, so real procedures survive.
export const LEGACY_PACK_SIZE = /\d+\s?(?:g|kg|mg|ml|l|cm|mm)\b/i;

// 3. Remaining clinical vocabulary. Diagnostics is tested before Vaccination so
//    that "rabies test" is a test rather than a vaccination.
export const LEGACY_SERVICE_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  [
    "Diagnostics",
    /\btest\b|titer|snap(?!\s)|fiv|felv|panleukopenia|calici|babesia|\bfip\b|cbc|certificate/i,
  ],
  [
    "Vaccination",
    /rabies|chppi|chhppil|dhpp|tricat|crp|nobivac|puppy dp|lepto/i,
  ],
  ["Parasite control", /deworm|ivermec/i],
];

export const LEGACY_DISCOUNT_SERVICE_ID = -1;
export const LEGACY_UNKNOWN_SERVICE_ID = -2;

// The old product catalogue numbered its categories but shipped no lookup table
// of names, so the numbers come across as-is for the clinic to rename. Anything
// not listed here keeps its number.
export const LEGACY_CATEGORY_NAMES: Record<string, string> = {};
