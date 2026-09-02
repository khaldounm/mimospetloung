import { z } from "zod";

// One click on the matrix: a single permission on a single role, on or off.
// The cascade that keeps read and write consistent is applied server-side in
// lib/rbac.ts, so the invariant holds no matter who calls this.
export const permissionToggleSchema = z.object({
  roleId: z.coerce.number().int().positive(),
  permission: z.string().trim().min(1).max(100),
  granted: z.boolean(),
});

export type PermissionToggleInput = z.infer<typeof permissionToggleSchema>;
