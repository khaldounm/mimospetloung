import { z } from "zod";
import { optionalString } from "./common";

const money = z.coerce.number().nonnegative().max(99_999_999.99);

export const serviceCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  category: optionalString(100),
  price: money,
  isActive: z.coerce.boolean().optional(),
  description: optionalString(5000),
});

export const serviceUpdateSchema = serviceCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;
