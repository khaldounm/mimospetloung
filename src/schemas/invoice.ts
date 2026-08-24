import { z } from "zod";
import { optionalString, optionalDate } from "./common";
import { CURRENCIES, PAYMENT_METHODS } from "@/types/enums";

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
  // Optional: an invoice with no client is a walk-in, an anonymous counter
  // sale that belongs to no account.
  clientId: optionalId,
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
  // Issue despite a vet still holding the invoice. Deliberate, and audited.
  overrideVetHold: z.coerce.boolean().optional(),
});

// Put the invoice on hold while a vet works on it, or clear the hold.
export const vetHoldSchema = z.object({
  hold: z.coerce.boolean(),
  attendingVetId: optionalId,
});

// --- Line items (draft only) ---

// Amount asked for on a loose line, in the item's loose unit (2 for "2 kg").
// The server converts it to a pack quantity and a price, because the conversion
// has to agree with what moves stock and cannot be trusted from the client.
const optionalLooseQty = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().positive().max(999_999).optional(),
);

export const lineItemCreateSchema = z
  .object({
    serviceId: optionalId,
    itemId: optionalId,
    // Optional label/price overrides; default to the source name/price.
    description: optionalString(255),
    // Pack quantity. Optional only when looseQty is given instead, since the
    // server derives it from that.
    quantity: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().positive().max(999_999).optional(),
    ),
    looseQty: optionalLooseQty,
    unitPrice: optionalMoney,
  })
  .superRefine((data, ctx) => {
    if (data.quantity === undefined && data.looseQty === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "A quantity is required",
      });
    }
    if (data.looseQty !== undefined && data.serviceId) {
      ctx.addIssue({
        code: "custom",
        path: ["looseQty"],
        message: "Only inventory items can be sold loose",
      });
    }
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

// A single scan at the counter. The barcode is resolved server-side so the
// increment-or-create decision is made in one place, under one transaction.
export const lineItemScanSchema = z.object({
  barcode: z.string().trim().min(1, "A barcode is required").max(100),
  quantity: z.coerce.number().positive().max(999_999).default(1),
});

export const lineItemUpdateSchema = z
  .object({
    description: optionalString(255),
    quantity: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().positive().max(999_999).optional(),
    ),
    // Editing a loose line re-derives quantity and price from the new amount,
    // so the two are never sent together.
    looseQty: optionalLooseQty,
    unitPrice: optionalMoney,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  })
  .refine(
    (data) => !(data.quantity !== undefined && data.looseQty !== undefined),
    {
      message: "Send either a pack quantity or a loose amount, not both",
      path: ["looseQty"],
    },
  );

// --- Payments (append-only) ---

const optionalMethod = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.enum(PAYMENT_METHODS).optional(),
);

// One settlement, which can span currencies: cash comes over the counter as
// some dollars and the rest in lira. Each leg is the amount APPLIED to the
// invoice in that currency, not the cash handed over, since change is given
// back at the counter and never reaches the ledger.
const tenderSchema = z.object({
  currency: z.enum(CURRENCIES),
  amount: z.coerce.number().nonnegative().max(999_999_999_999),
});

export const paymentCreateSchema = z.object({
  tenders: z.array(tenderSchema).min(1, "Enter an amount"),
  method: optionalMethod,
  reference: optionalString(100),
  paidAt: optionalDate,
  notes: optionalString(5000),
});

// One line coming back. The quantity is always a positive magnitude: the sign
// that makes it a return is put on by the server, so a caller cannot get it
// backwards and credit a customer for buying something.
export const returnEntrySchema = z.object({
  sourceLineItemId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(999_999),
  // No default. Guessing this either invents stock the clinic cannot sell or
  // bins stock it can, so whoever takes the return has to say which it is.
  restock: z.boolean(),
  lotNumber: optionalString(100),
  // Required by the server for an item tracked by expiry, where it decides which
  // lot the goods rejoin.
  expiryDate: optionalDate,
});

export const returnCreateSchema = z.object({
  entries: z.array(returnEntrySchema).min(1, "Choose at least one line"),
});

export type ReturnCreateInput = z.infer<typeof returnCreateSchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
export type InvoiceTransitionInput = z.infer<typeof invoiceTransitionSchema>;
export type LineItemCreateInput = z.infer<typeof lineItemCreateSchema>;
export type LineItemScanInput = z.infer<typeof lineItemScanSchema>;
export type LineItemUpdateInput = z.infer<typeof lineItemUpdateSchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type VetHoldInput = z.infer<typeof vetHoldSchema>;
