import { z } from "zod";
import {
  optionalCostPct,
  optionalLinkId,
  optionalProfitPct,
  optionalString,
} from "./common";

const money = z.coerce.number().nonnegative().max(99_999_999.99);

// One ingredient of a service's cost. A discriminated union rather than one
// loose object with four optional fields: the two shapes are genuinely
// different, and this way an item row missing its quantity fails here instead
// of at the DB CHECK that backs the same rule.
const costComponentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("item"),
    itemId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().positive().max(1_000_000),
  }),
  z.object({
    kind: z.literal("flat"),
    label: z.string().trim().min(1, "Label is required").max(200),
    amount: money,
  }),
]);

// Bounded so one request cannot ask for an unbounded write. Fifty ingredients
// is already far past anything a real procedure lists.
const costComponents = z.array(costComponentSchema).max(50).optional();

export type ServiceCostComponentInput = z.infer<typeof costComponentSchema>;

export const serviceCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  category: optionalString(100),
  price: money,
  isActive: z.coerce.boolean().optional(),
  description: optionalString(5000),
  // Who performs it and on what terms. Same shape as the consignment fields on
  // an inventory item, so one set of helpers covers both deals.
  partnerId: optionalLinkId,
  partnerCostPct: optionalCostPct,
  partnerProfitPct: optionalProfitPct,
  // The whole recipe, or absent. Absent means "leave the cost alone", which is
  // what keeps a plain price edit from wiping a service's components.
  costComponents,
});

export const serviceUpdateSchema = serviceCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;

// The fields that describe a partner's cut. Named here so both service routes
// gate the same set, and adding a fourth cannot be half-guarded.
export const SERVICE_DEAL_FIELDS = [
  "partnerId",
  "partnerCostPct",
  "partnerProfitPct",
] as const;

export function touchesPartnerDeal(data: Record<string, unknown>): boolean {
  return SERVICE_DEAL_FIELDS.some((f) => data[f] !== undefined);
}

// Input rows -> the two column shapes the table stores, which is also what the
// service_cost_components_one_shape CHECK expects. One place, so create and
// update cannot drift.
export function toCostComponentRows(components: ServiceCostComponentInput[]): {
  itemId?: number;
  quantity?: number;
  label?: string;
  amount?: number;
}[] {
  return components.map((c) =>
    c.kind === "item"
      ? { itemId: c.itemId, quantity: c.quantity }
      : { label: c.label, amount: c.amount },
  );
}
