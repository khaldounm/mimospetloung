// An offer is a deal the clinic decides to give, granted to a client and then
// redeemed against one invoice. The three are separate on purpose: see the
// Offer model in prisma/schema.prisma.

// The two ways an offer states its discount, mirroring the two an invoice
// carries. Enforced in Postgres by offers_one_discount_mode.
export const OFFER_DISCOUNT_MODES = ["pct", "amount"] as const;
export type OfferDiscountMode = (typeof OFFER_DISCOUNT_MODES)[number];

// Who may do what with an offer.
//
// Granting rides on invoices:write, the permission that already lets someone
// type a discount at the counter: an offer is that same decision, made in
// advance and recorded.
export const OFFER_GRANT_PERMISSION = "invoices:write";

// Creating and retiring offers is deliberately tighter than granting them. If
// anyone can invent a deal while looking at one client, the clinic ends up with
// fifteen spellings of "10% off" and no campaign it can report on. This is the
// same permission Settings rides on, which is Admin in practice.
export const OFFER_MANAGE_PERMISSION = "users:write";

// Rates the new-offer form puts one click away. Typing any other figure is
// still allowed; these are just the ones the clinic actually uses.
export const OFFER_QUICK_PERCENTAGES = [10, 15, 20];

// How many clients one grant action may cover. The top-clients table pages at
// ten, but the analytics list can be filtered to a much longer range, and a
// slip on a select-all should not silently discount half the client book.
export const OFFER_GRANT_BATCH_LIMIT = 100;
