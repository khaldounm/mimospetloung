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
