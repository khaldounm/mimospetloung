import { z } from "zod";
import { optionalString } from "./common";
import { INVENTORY_CATEGORIES } from "@/constants/inventory";

// Blank email is "not provided", not an invalid address, so it must be stripped
// before the format check runs. Mirrors the client schema.
const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.email("Invalid email").max(160).optional(),
);

// One person at the supplier. contactId is present when the repeater is editing
// a row that already exists, absent for a newly added one, which is how the
// save distinguishes an update from an insert and keeps ids stable.
//
// A contact must be reachable: name alone is a note, not a contact. The DB
// carries the same rule as a CHECK so it holds however the row arrives.
export const supplierContactSchema = z
  .object({
    contactId: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1, "Contact name is required").max(120),
    role: optionalString(60),
    categories: z.array(z.enum(INVENTORY_CATEGORIES)).default([]),
    phone: optionalString(40),
    email: optionalEmail,
    notes: optionalString(5000),
    isPrimary: z.coerce.boolean().optional(),
  })
  .refine((c) => Boolean(c.phone) || Boolean(c.email), {
    message: "Add a phone number or an email",
    path: ["phone"],
  });

// Contacts arrive as the whole set, not a delta: the form edits them inline and
// saves once, so anything missing from the array was removed.
const contacts = z.array(supplierContactSchema).max(20).optional();

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  contacts,
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
export type SupplierContactInput = z.infer<typeof supplierContactSchema>;
export type SupplierPaymentCreateInput = z.infer<
  typeof supplierPaymentCreateSchema
>;
