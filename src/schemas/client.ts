import { z } from "zod";
import { optionalString } from "./common";

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

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
