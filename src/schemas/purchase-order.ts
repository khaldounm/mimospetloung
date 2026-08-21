import { z } from "zod";
import { optionalString, optionalDate } from "./common";

// Order quantity: always a positive magnitude (a line for zero is a line that
// should not exist, so it is removed instead).
const quantity = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ message: "Quantity is required" })
    .positive("Quantity must be greater than zero")
    .max(1_000_000),
);

// Amount keyed in the item's loose unit (200 for "200 kg"). The server converts
// it to a pack quantity and a per-pack cost, so the browser never decides how
// many bags 200 kg is.
const optionalLooseQty = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().positive().max(1_000_000).optional(),
);

// Non-negative unit cost. Blank -> undefined (cost not known yet).
const optionalCost = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().nonnegative().max(99_999_999.99).optional(),
);

// Order-level charge (discount, delivery, VAT amount). Each is a non-negative
// magnitude; which way it moves the total is fixed by which field it is, not by
// its sign. Blank -> null (clears it).
const optionalCharge = z
  .preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().nonnegative().max(99_999_999.99).nullable(),
  )
  .optional();

// VAT percentage (0..100). Blank -> null, which means no VAT on this bill.
const optionalRate = z
  .preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().min(0).max(100).nullable(),
  )
  .optional();

// Optional supplier link. Blank / 0 -> null, which parks the order back in the
// "No supplier" bucket.
const optionalSupplierId = z
  .preprocess(
    (v) => (v === "" || v === null || v === 0 || v === "0" ? null : v),
    z.coerce.number().int().positive().nullable(),
  )
  .optional();

export const purchaseOrderCreateSchema = z.object({
  supplierId: optionalSupplierId,
  reference: optionalString(100),
  notes: optionalString(5000),
});

// Header edits only. Status changes go through the dedicated place / receive /
// cancel routes so their side effects can never be skipped by a plain PATCH.
export const purchaseOrderUpdateSchema = z
  .object({
    supplierId: optionalSupplierId,
    reference: optionalString(100),
    orderedOn: optionalDate,
    discountAmount: optionalCharge,
    shippingAmount: optionalCharge,
    taxRate: optionalRate,
    taxAmount: optionalCharge,
    notes: optionalString(5000),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

// quantityOrdered becomes optional when a loose amount is sent instead, since
// the server derives one from the other.
const optionalQuantity = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().positive().max(1_000_000).optional(),
);

export const purchaseOrderLineCreateSchema = z
  .object({
    itemId: z.coerce.number().int().positive(),
    quantityOrdered: optionalQuantity,
    looseQty: optionalLooseQty,
    unitCost: optionalCost,
    notes: optionalString(5000),
  })
  .refine((d) => d.quantityOrdered !== undefined || d.looseQty !== undefined, {
    message: "Quantity is required",
    path: ["quantityOrdered"],
  });

export const purchaseOrderLineUpdateSchema = z
  .object({
    quantityOrdered: quantity,
    looseQty: optionalLooseQty,
    unitCost: optionalCost,
    notes: optionalString(5000),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

// One delivery against an order. Lines left out, or sent as zero, simply did not
// arrive this time and stay outstanding for a later receipt.
export const receiveOrderSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.coerce.number().int().positive(),
        quantity: z.preprocess(
          (v) => (v === "" || v === null || v === undefined ? 0 : v),
          z.coerce.number().nonnegative().max(1_000_000),
        ),
        // What the supplier actually invoiced for this delivery. The order was
        // raised from an estimate, so this is the first point the real figure
        // is known. Omitted leaves the line's existing cost standing.
        unitCost: optionalCost,
        // When the delivery note is written in kilos rather than bags. The cost
        // above is then per kilo and converts with it.
        looseQty: optionalLooseQty,
        // Off the carton, for perishables. Ignored on items that do not track
        // expiry, so a leash never needs one.
        lotNumber: optionalString(100),
        expiryDate: optionalDate,
      }),
    )
    .min(1, "Nothing to receive"),
  receivedOn: optionalDate,
});

// Bulk push from the inventory low-stock basket. Each line is routed to the
// open draft for that item's usual supplier, so the client never picks an order.
export const addToFutureOrderSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.coerce.number().int().positive(),
        quantity,
      }),
    )
    .min(1, "Pick at least one item"),
});

export type PurchaseOrderLineCreateInput = z.infer<
  typeof purchaseOrderLineCreateSchema
>;
export type AddToFutureOrderInput = z.infer<typeof addToFutureOrderSchema>;
