import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { clientUpdateSchema } from "@/schemas/client";

async function getClientId(params: Promise<{ clientId: string }>) {
  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  return handle(async () => {
    await requirePermission("patients:read");
    const clientId = await getClientId(params);

    const client = await prisma.client.findFirst({
      where: { clientId, deletedAt: null },
      include: {
        patients: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!client) throw new ApiError(404, "Client not found");

    return NextResponse.json({ client });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("patients:write");
    const clientId = await getClientId(params);
    const data = await parseBody(request, clientUpdateSchema);

    const existing = await prisma.client.findFirst({
      where: { clientId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, "Client not found");

    const client = await prisma.client.update({
      where: { clientId },
      data,
    });
    await writeAudit(session, {
      action: "update",
      entity: "client",
      entityId: clientId,
      changes: data,
    });
    return NextResponse.json({ client });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("patients:write");
    const clientId = await getClientId(params);

    const existing = await prisma.client.findFirst({
      where: { clientId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, "Client not found");

    // Soft-delete: never hard-delete client records.
    await prisma.client.update({
      where: { clientId },
      data: { deletedAt: new Date() },
    });
    await writeAudit(session, {
      action: "delete",
      entity: "client",
      entityId: clientId,
      changes: { softDelete: true },
    });
    return NextResponse.json({ ok: true });
  });
}
