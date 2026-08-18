import { z } from "zod";
import { optionalString } from "./common";

// Minimum password strength enforced for admin-set credentials.
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72);

export const userCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.email("Invalid email").max(255),
  phone: optionalString(20),
  roleId: z.coerce.number().int().positive("Role is required"),
  password,
});

// All fields optional on update; password is handled by its own endpoint.
export const userUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.email("Invalid email").max(255),
    phone: optionalString(20),
    roleId: z.coerce.number().int().positive(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export const passwordResetSchema = z.object({ password });

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
