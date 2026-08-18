import { z } from "zod";
import { optionalString, optionalDate } from "./common";
import { PAYMENT_METHODS } from "@/types/enums";

// Optional numeric id from a form: "" / null -> undefined, else positive int.
const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

// Percentage 0-100, optional (blank -> undefined so the default stands).
const optionalPct = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().min(0).max(100).optional(),
);

const optionalMoney = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().nonnegative().max(99_999_999.99).optional(),
);

// --- Invoice (draft creation + draft edits) ---

export const invoiceCreateSchema = z.object({
  clientId: z.coerce.number().int().positive(),
  bookingId: optionalId,
  dueDate: optionalDate,
  discountPct: optionalPct,
  taxPct: optionalPct,
  notes: optionalString(5000),
});

export const invoiceUpdateSchema = z
  .object({
    clientId: optionalId,
    bookingId: optionalId,
    dueDate: optionalDate,
    discountPct: optionalPct,
    taxPct: optionalPct,
    notes: optionalString(5000),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

// Status transitions are a separate action from field edits. Only Issued and
// Void are reachable via the API; Partial/Paid are derived from payments.
export const invoiceTransitionSchema = z.object({
  status: z.enum(["Issued", "Void"]),
});

// --- Line items (draft only) ---

export const lineItemCreateSchema = z
  .object({
    serviceId: optionalId,
    itemId: optionalId,
    // Optional label/price overrides; default to the source name/price.
    description: optionalString(255),
    quantity: z.coerce.number().positive().max(999_999),
    unitPrice: optionalMoney,
  })
  .superRefine((data, ctx) => {
    if (!data.serviceId && !data.itemId) {
      ctx.addIssue({
        code: "custom",
        path: ["serviceId"],
        message: "Choose a service or an inventory item",
      });
    }
    if (data.serviceId && data.itemId) {
      ctx.addIssue({
        code: "custom",
        path: ["itemId"],
        message: "Pick only one of service or inventory item",
      });
    }
  });

export const lineItemUpdateSchema = z
  .object({
    description: optionalString(255),
    quantity: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().positive().max(999_999).optional(),
    ),
    unitPrice: optionalMoney,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

// --- Payments (append-only) ---

const optionalMethod = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.enum(PAYMENT_METHODS).optional(),
);

export const paymentCreateSchema = z.object({
  amount: z.coerce.number().positive().max(99_999_999.99),
  method: optionalMethod,
  reference: optionalString(100),
  paidAt: optionalDate,
  notes: optionalString(5000),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
export type InvoiceTransitionInput = z.infer<typeof invoiceTransitionSchema>;
export type LineItemCreateInput = z.infer<typeof lineItemCreateSchema>;
export type LineItemUpdateInput = z.infer<typeof lineItemUpdateSchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
