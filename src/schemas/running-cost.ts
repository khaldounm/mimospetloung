import { z } from "zod";
import { optionalString } from "./common";

// Non-negative money value. Blank -> rejected (amount is required).
const money = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ message: "Amount is required" })
    .nonnegative("Amount must be zero or more")
    .max(99_999_999.99),
);

// Required date (the day the cost was incurred). Blank -> validation error.
const incurredOn = z.preprocess(
  (v) => {
    if (typeof v !== "string" || v.trim() === "") return undefined;
    return v;
  },
  z.coerce.date({ message: "Date is required" }),
);

export const runningCostCreateSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(100),
  description: z.string().trim().min(1, "Item is required").max(200),
  amount: money,
  incurredOn,
  notes: optionalString(5000),
});

export const runningCostUpdateSchema = runningCostCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type RunningCostCreateInput = z.infer<typeof runningCostCreateSchema>;
