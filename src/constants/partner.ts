// Partner (outsourced / consignment inventory) copy + option constants.

// Payment methods offered when recording a payout to a partner. Mirrors the
// invoice PAYMENT_METHODS shape but kept separate so the two can diverge.
export const PARTNER_PAYOUT_METHODS = [
  "Cash",
  "Card",
  "Bank Transfer",
  "Other",
] as const;

export type PartnerPayoutMethod = (typeof PARTNER_PAYOUT_METHODS)[number];

// Plain-language definitions surfaced on the partners screens. Consignment
// blends two very different things into one payout (the partner's capital coming
// back, and their cut of the profit), which is the single biggest source of
// confusion when reading these figures, so the UI spells it out rather than
// leaving it to be worked out from the numbers.
export const PARTNER_GLOSSARY: { term: string; meaning: string }[] = [
  {
    term: "Revenue",
    meaning: "What customers paid for the partner's items.",
  },
  {
    term: "Capital",
    meaning:
      "The partner's own money in the stock: what has already come back through sales plus what is still on the shelf. It is not profit for anyone, it is their stake being returned.",
  },
  {
    term: "Gross profit",
    meaning: "Revenue minus what that stock cost. This is what gets split.",
  },
  {
    term: "Their share",
    meaning:
      "The partner's cut of the gross profit only, at their agreed percentage.",
  },
  {
    term: "Clinic share",
    meaning:
      "What the clinic keeps. It can be negative: if an item sells below cost the partner still gets their full capital back and no share, so the clinic absorbs the loss.",
  },
  {
    term: "Owed",
    meaning:
      "Capital plus their share, minus payouts already made. Split into the two so it is clear how much is their money going back and how much is their earnings. Payouts settle capital first.",
  },
  {
    term: "Performance vs Position",
    meaning:
      "Performance is a flow: what sold during the dates you picked, and nothing outside them. Position is a balance, so it counts everything from the start up to the last day of your range. Since every shortcut ends today, the position figures read as all-time until you set an earlier To date, which shows where things stood back then.",
  },
];
