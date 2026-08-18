import { z } from "zod";
import { optionalString, optionalDate } from "./common";
import { INVENTORY_TX_TYPES } from "@/types/enums";

// Non-negative money value (sale price / cost). Blank -> undefined.
const optionalMoney = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().nonnegative().max(99_999_999.99).optional(),
);

const optionalPositiveInt = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

// Non-negative stock quantity (2dp). Blank -> undefined.
const optionalQuantity = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().nonnegative().max(1_000_000).optional(),
);

// Optional link to another row (sourcing partner, usual supplier). Blank / 0 ->
// null, which clears the link rather than leaving it untouched.
const optionalLinkId = z
  .preprocess(
    (v) => (v === "" || v === null || v === 0 || v === "0" ? null : v),
    z.coerce.number().int().positive().nullable(),
  )
  .optional();

// Optional per-item profit-share override (0..100). Blank -> null.
const optionalSharePct = z
  .preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().min(0).max(100).nullable(),
  )
  .optional();

// Item metadata plus an optional opening stock. Ongoing stock still moves solely
// through inventory transactions; opening stock just seeds the first Received
// movement at create time, so the audit log stays the source of truth.
export const inventoryItemCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  category: optionalString(100),
  barcode: optionalString(100),
  unit: optionalString(50),
  reorderLevel: z.coerce.number().int().nonnegative().max(1_000_000).default(0),
  salePrice: optionalMoney,
  lastCost: optionalMoney,
  partnerId: optionalLinkId,
  partnerSharePct: optionalSharePct,
  supplierId: optionalLinkId,
  expiryDate: optionalDate,
  notes: optionalString(5000),
  openingStock: optionalQuantity,
});

// Updates never touch stock directly (that is what movements are for), so drop
// openingStock from the update shape.
export const inventoryItemUpdateSchema = inventoryItemCreateSchema
  .omit({ openingStock: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

// A single stock movement. `quantity` is a magnitude for directional types
// (Received/Used/Sold/Expired) and a signed delta for Adjusted corrections.
// The server converts this into the signed value stored on the transaction.
export const inventoryTransactionSchema = z
  .object({
    type: z.enum(INVENTORY_TX_TYPES),
    quantity: z.coerce.number().max(99_999_999.99).min(-99_999_999.99),
    unitCost: optionalMoney,
    referenceType: optionalString(50),
    referenceId: optionalPositiveInt,
    notes: optionalString(5000),
  })
  .superRefine((data, ctx) => {
    if (data.quantity === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Quantity cannot be zero",
      });
    }
    if (data.type !== "Adjusted" && data.quantity < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Quantity must be a positive number",
      });
    }
    if (data.type === "Received" && data.unitCost === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["unitCost"],
        message: "Unit cost is required when receiving stock",
      });
    }
  });

export type InventoryTransactionInput = z.infer<
  typeof inventoryTransactionSchema
>;
