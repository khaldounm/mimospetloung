import { z } from "zod";
import { optionalString } from "./common";

// Profit-share percentage (0..100). Blank / absent -> 0.
const sharePct = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce
    .number({ message: "Share must be a number" })
    .min(0, "Share must be 0 or more")
    .max(100, "Share must be 100 or less"),
);

export const partnerCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: optionalString(40),
  defaultSharePct: sharePct,
  notes: optionalString(5000),
  isActive: z.coerce.boolean().optional(),
});

export const partnerUpdateSchema = partnerCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

// ---- Payout ----

// Payout amount (must be greater than zero). Blank -> validation error.
const money = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ message: "Amount is required" })
    .positive("Amount must be greater than zero")
    .max(99_999_999.99),
);

// Required date the payout was made. Blank -> validation error.
const paidOn = z.preprocess(
  (v) => {
    if (typeof v !== "string" || v.trim() === "") return undefined;
    return v;
  },
  z.coerce.date({ message: "Date is required" }),
);

export const partnerPayoutCreateSchema = z.object({
  amount: money,
  paidOn,
  method: optionalString(50),
  reference: optionalString(100),
  notes: optionalString(5000),
});

// ---- Range query ----

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

// The from/to pair the partner reads accept for their range-scoped figures.
// Both absent means "use the default range", which the caller supplies.
export const partnerRangeQuerySchema = z
  .object({ from: dateString, to: dateString })
  .refine((d) => d.from <= d.to, {
    message: "from must be on or before to",
    path: ["from"],
  });

export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>;
export type PartnerPayoutCreateInput = z.infer<
  typeof partnerPayoutCreateSchema
>;
