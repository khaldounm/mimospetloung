import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserDTO } from "@/types/entities";

// A user is treated as an "admin" (for lockout protection) if their role grants
// the permission to manage other users.
export const USER_ADMIN_PERMISSION = "users:write";

const BCRYPT_ROUNDS = 10;

// Relations pulled when rendering a user with its role + permission summary.
export const userInclude = {
  role: {
    include: { rolePermissions: { include: { permission: true } } },
  },
} as const;

type UserRow = {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roleId: number;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  role: {
    name: string;
    rolePermissions: { permission: { name: string } }[];
  };
};

export function toUserDTO(u: UserRow): UserDTO {
  const canManageUsers = u.role.rolePermissions.some(
    (rp) => rp.permission.name === USER_ADMIN_PERMISSION,
  );
  return {
    userId: u.userId,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    roleId: u.roleId,
    roleName: u.role.name,
    isActive: u.isActive,
    canManageUsers,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

// Whether a role grants user-management rights. Used to decide if a change
// would remove the last admin.
export async function roleCanManageUsers(roleId: number): Promise<boolean> {
  const count = await prisma.rolePermission.count({
    where: { roleId, permission: { name: USER_ADMIN_PERMISSION } },
  });
  return count > 0;
}

// Count active users who can manage users, optionally excluding one user.
// Used to block removing/demoting/deactivating the last admin.
export async function countActiveAdmins(
  excludeUserId?: number,
): Promise<number> {
  return prisma.user.count({
    where: {
      isActive: true,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      role: {
        rolePermissions: {
          some: { permission: { name: USER_ADMIN_PERMISSION } },
        },
      },
    },
  });
}
