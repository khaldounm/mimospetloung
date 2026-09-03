import { z } from "zod";
import {
  OFFER_DISCOUNT_MODES,
  OFFER_GRANT_BATCH_LIMIT,
} from "@/constants/offers";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const money = z.coerce.number().min(0).max(1_000_000);
const pct = z.coerce.number().min(0).max(100);

// One discount, typed one way. The DB says the same thing in
// offers_one_discount_mode; this is what turns a violation into a readable
// message instead of a 500 from Postgres.
const oneMode = <
  T extends {
    discountMode: string;
    discountPct: number;
    discountAmount: number;
  },
>(
  data: T,
  ctx: z.RefinementCtx,
) => {
  if (data.discountMode === "pct" && data.discountPct <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a percentage above zero",
      path: ["discountPct"],
    });
  }
  if (data.discountMode === "amount" && data.discountAmount <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "Enter an amount above zero",
      path: ["discountAmount"],
    });
  }
};

// Creating an offer. The unused side of the discount defaults to zero rather
// than being optional, so the row written always satisfies the CHECK.
export const createOfferSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    discountMode: z.enum(OFFER_DISCOUNT_MODES),
    discountPct: pct.default(0),
    discountAmount: money.default(0),
    notes: z.string().trim().max(2000).nullish(),
    expiresOn: dateString.nullish(),
  })
  .superRefine(oneMode);

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

// Editing an offer, or retiring it. Terms stay editable: a campaign extended by
// a week is the same campaign, and grants read their offer live.
export const updateOfferSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    discountMode: z.enum(OFFER_DISCOUNT_MODES),
    discountPct: pct.default(0),
    discountAmount: money.default(0),
    notes: z.string().trim().max(2000).nullish(),
    expiresOn: dateString.nullish(),
    archived: z.boolean().optional(),
  })
  .superRefine(oneMode);

export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;

// Granting one offer to a set of clients. Capped, because this is reachable
// from a list that can be filtered to the whole client book and a slip on a
// select-all should not discount all of it.
export const grantOfferSchema = z.object({
  offerId: z.coerce.number().int().positive(),
  clientIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "Pick at least one client")
    .max(
      OFFER_GRANT_BATCH_LIMIT,
      `At most ${OFFER_GRANT_BATCH_LIMIT} clients at a time`,
    ),
});

export type GrantOfferInput = z.infer<typeof grantOfferSchema>;

// Redeeming a grant against a draft invoice.
export const redeemOfferSchema = z.object({
  grantId: z.coerce.number().int().positive(),
});

export type RedeemOfferInput = z.infer<typeof redeemOfferSchema>;
