import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/users";
import { passwordResetSchema } from "@/schemas/user";

async function getUserId(params: Promise<{ userId: string }>) {
  const { userId } = await params;
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

// Admin-set password reset. The new password is hashed and never logged.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("users:write");
    const userId = await getUserId(params);
    const { password } = await parseBody(request, passwordResetSchema);

    const existing = await prisma.user.findUnique({ where: { userId } });
    if (!existing) throw new ApiError(404, "User not found");

    await prisma.user.update({
      where: { userId },
      data: {
        passwordHash: await hashPassword(password),
        updatedAt: new Date(),
      },
    });

    await writeAudit(session, {
      action: "update",
      entity: "user",
      entityId: userId,
      changes: { passwordChanged: true },
    });

    return NextResponse.json({ ok: true });
  });
}
