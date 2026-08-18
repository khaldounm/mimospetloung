import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { hashPassword, toUserDTO, userInclude } from "@/lib/users";
import { userCreateSchema } from "@/schemas/user";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("users:read");

    const sp = new URL(request.url).searchParams;
    const q = sp.get("q")?.trim();
    const activeOnly = sp.get("activeOnly") === "true";

    const users = await prisma.user.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: userInclude,
      orderBy: [
        { isActive: "desc" },
        { firstName: "asc" },
        { lastName: "asc" },
      ],
    });

    return NextResponse.json({ users: users.map(toUserDTO) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("users:write");
    const data = await parseBody(request, userCreateSchema);

    const role = await prisma.role.findUnique({
      where: { roleId: data.roleId },
    });
    if (!role) throw new ApiError(400, "roleId: role not found");

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing)
      throw new ApiError(409, "A user with this email already exists");

    const user = await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        roleId: data.roleId,
        passwordHash: await hashPassword(data.password),
      },
      include: userInclude,
    });

    await writeAudit(session, {
      action: "create",
      entity: "user",
      entityId: user.userId,
      // Never log the password or its hash.
      changes: {
        email: data.email,
        roleId: data.roleId,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    return NextResponse.json({ user: toUserDTO(user) }, { status: 201 });
  });
}
