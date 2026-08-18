import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { clientInclude, toClientDTO } from "@/lib/clients";
import { clientCreateSchema } from "@/schemas/client";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("patients:read");

    const q = new URL(request.url).searchParams.get("q")?.trim();
    const clients = await prisma.client.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: clientInclude,
    });

    return NextResponse.json({ clients: clients.map(toClientDTO) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("patients:write");
    const data = await parseBody(request, clientCreateSchema);

    const client = await prisma.client.create({ data });
    await writeAudit(session, {
      action: "create",
      entity: "client",
      entityId: client.clientId,
      changes: data,
    });
    return NextResponse.json({ client }, { status: 201 });
  });
}
