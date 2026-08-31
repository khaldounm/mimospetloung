import { z } from "zod";
import {
  optionalDate,
  optionalMethod,
  optionalString,
  tenderSchema,
} from "./common";

export const clientCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: optionalString(20),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.email("Invalid email").max(255).optional(),
  ),
  notes: optionalString(5000),
});

// All fields optional on update; at least one must be present.
export const clientUpdateSchema = clientCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

// Money taken against the account itself, with no invoice behind it. Same
// currency legs as an invoice payment: what settles the account is the USD
// equivalent, and each leg records the notes that crossed the counter.
export const accountPaymentCreateSchema = z.object({
  tenders: z.array(tenderSchema).min(1, "Enter an amount"),
  method: optionalMethod,
  reference: optionalString(100),
  paidAt: optionalDate,
  notes: optionalString(5000),
});

export type AccountPaymentCreateInput = z.infer<
  typeof accountPaymentCreateSchema
>;
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

// Sending a client their statement. The period is optional: without it the
// statement covers the whole account, which is the default the page opens on.
// `detailed` decides whether every invoice is opened out into what was billed,
// so the client receives the statement staff were actually looking at.
export const clientStatementSendSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  detailed: z.boolean().optional(),
});
