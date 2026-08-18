import { z } from "zod";
import { optionalString } from "./common";

// Blank email is "not provided", not an invalid address, so it must be stripped
// before the format check runs. Mirrors the client schema.
const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.email("Invalid email").max(160).optional(),
);

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  contactPerson: optionalString(120),
  phone: optionalString(40),
  email: optionalEmail,
  notes: optionalString(5000),
  isActive: z.coerce.boolean().optional(),
});

export const supplierUpdateSchema = supplierCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

// ---- Payments ----

// Amount must be above zero. A correction is a soft delete plus a new entry,
// not a negative payment, matching how partner payouts work.
const money = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ message: "Amount is required" })
    .positive("Amount must be greater than zero")
    .max(99_999_999.99),
);

const paidOn = z.preprocess(
  (v) => (typeof v !== "string" || v.trim() === "" ? undefined : v),
  z.coerce.date({ message: "Date is required" }),
);

// Blank / 0 -> null, meaning a lump sum against the account rather than one bill.
const optionalOrderId = z
  .preprocess(
    (v) => (v === "" || v === null || v === 0 || v === "0" ? null : v),
    z.coerce.number().int().positive().nullable(),
  )
  .optional();

export const supplierPaymentCreateSchema = z.object({
  orderId: optionalOrderId,
  amount: money,
  paidOn,
  method: optionalString(50),
  reference: optionalString(100),
  notes: optionalString(5000),
});

export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
export type SupplierPaymentCreateInput = z.infer<
  typeof supplierPaymentCreateSchema
>;
