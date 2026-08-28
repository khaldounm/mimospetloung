import { z } from "zod";
import { optionalString } from "./common";
import { CURRENCIES } from "@/types/enums";

// Cash counted in a drawer. Blank means none, not a refusal: a day that took no
// lira still has to be closed, and making someone type 0 to say so is how a
// close gets skipped.
const drawerAmount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce.number().nonnegative().max(999_999_999_999),
);

// One handful of cash out of the till. Category and item are the SAME two
// fields a running cost is entered with, because that is what this becomes:
// money out of the drawer is an operating cost, and it reaches analytics under
// whatever category it was filed as.
export const registerPayoutSchema = z.object({
  category: z.string().trim().min(1, "Pick a category").max(100),
  description: z.string().trim().min(1, "Say what it was for").max(200),
  amount: z.coerce.number().positive("Enter an amount").max(999_999_999_999),
  currency: z.enum(CURRENCIES),
});

export const registerCloseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  openingUsd: drawerAmount,
  openingLbp: drawerAmount,
  countedUsd: drawerAmount,
  countedLbp: drawerAmount,
  payouts: z.array(registerPayoutSchema).max(50).default([]),
  notes: optionalString(5000),
});

export type RegisterPayoutInput = z.infer<typeof registerPayoutSchema>;
export type RegisterCloseInput = z.infer<typeof registerCloseSchema>;
