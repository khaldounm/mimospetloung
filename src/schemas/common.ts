import { z } from "zod";
import { CURRENCIES, PAYMENT_METHODS } from "@/types/enums";

// Treat empty/whitespace form values as "absent" so optional fields don't
// fail max-length or format checks on blank input.
export function optionalString(max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );
}

// ISO date string (YYYY-MM-DD or full ISO) -> Date, or undefined when blank.
export const optionalDate = z.preprocess((v) => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  return v;
}, z.coerce.date().optional());

// --- Partner deals (consigned stock, and services a partner performs) ---

// Optional link to another row (sourcing partner, usual supplier). Blank / 0 ->
// null, which clears the link rather than leaving it untouched.
export const optionalLinkId = z
  .preprocess(
    (v) => (v === "" || v === null || v === 0 || v === "0" ? null : v),
    z.coerce.number().int().positive().nullable(),
  )
  .optional();

// Optional profit-share override (0..100). Blank -> null, meaning the row
// follows the partner's default.
export const optionalProfitPct = z
  .preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().min(0).max(100).nullable(),
  )
  .optional();

// Optional cost-share override. Allowed above 100 for the same reason as the
// partner default: that is how an uplift on cost is written.
export const optionalCostPct = z
  .preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().min(0).max(999.99).nullable(),
  )
  .optional();

// --- Payments ---

export const optionalMethod = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.enum(PAYMENT_METHODS).optional(),
);

// One leg of a settlement, which can span currencies: cash comes over the
// counter as some dollars and the rest in lira. Each leg is the amount APPLIED
// in that currency, not the cash handed over, since change is given back at the
// counter and never reaches the ledger.
export const tenderSchema = z.object({
  currency: z.enum(CURRENCIES),
  amount: z.coerce.number().nonnegative().max(999_999_999_999),
});
