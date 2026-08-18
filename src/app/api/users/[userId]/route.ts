import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import {
  countActiveAdmins,
  roleCanManageUsers,
  toUserDTO,
  userInclude,
} from "@/lib/users";
import { userUpdateSchema } from "@/schemas/user";

async function getUserId(params: Promise<{ userId: string }>) {
  const { userId } = await params;
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  return handle(async () => {
    await requirePermission("users:read");
    const userId = await getUserId(params);

    const user = await prisma.user.findUnique({
      where: { userId },
      include: userInclude,
    });
    if (!user) throw new ApiError(404, "User not found");

    return NextResponse.json({ user: toUserDTO(user) });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("users:write");
    const userId = await getUserId(params);
    const data = await parseBody(request, userUpdateSchema);

    const existing = await prisma.user.findUnique({
      where: { userId },
      include: userInclude,
    });
    if (!existing) throw new ApiError(404, "User not found");

    // Validate a new role and a new email up front for friendly errors.
    if (data.roleId !== undefined && data.roleId !== existing.roleId) {
      const role = await prisma.role.findUnique({
        where: { roleId: data.roleId },
      });
      if (!role) throw new ApiError(400, "roleId: role not found");
    }
    if (data.email !== undefined && data.email !== existing.email) {
      const dupe = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (dupe)
        throw new ApiError(409, "A user with this email already exists");
    }

    // Lockout guard rails. Compute the user's post-update admin status.
    const isSelf = userId === session.user.userId;
    const willBeActive = data.isActive ?? existing.isActive;
    const willBeAdmin =
      data.roleId !== undefined && data.roleId !== existing.roleId
        ? await roleCanManageUsers(data.roleId)
        : existing.role.rolePermissions.some(
            (rp) => rp.permission.name === "users:write",
          );

    // Block self-deactivation outright.
    if (isSelf && data.isActive === false) {
      throw new ApiError(400, "You cannot deactivate your own account");
    }

    // If this user is currently an active admin and the change would drop them
    // out of that set (deactivate or demote), ensure another active admin stays.
    const wasActiveAdmin =
      existing.isActive &&
      existing.role.rolePermissions.some(
        (rp) => rp.permission.name === "users:write",
      );
    if (wasActiveAdmin && (!willBeActive || !willBeAdmin)) {
      const others = await countActiveAdmins(userId);
      if (others < 1) {
        throw new ApiError(400, "Cannot remove the last active administrator");
      }
    }

    const user = await prisma.user.update({
      where: { userId },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.roleId !== undefined ? { roleId: data.roleId } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date(),
      },
      include: userInclude,
    });

    await writeAudit(session, {
      action: "update",
      entity: "user",
      entityId: userId,
      changes: data,
    });

    return NextResponse.json({ user: toUserDTO(user) });
  });
}
