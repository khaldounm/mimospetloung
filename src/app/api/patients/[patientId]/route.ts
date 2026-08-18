import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { patientUpdateSchema } from "@/schemas/patient";

async function getPatientId(params: Promise<{ patientId: string }>) {
  const { patientId } = await params;
  const id = Number(patientId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  return handle(async () => {
    await requirePermission("patients:read");
    const patientId = await getPatientId(params);

    const patient = await prisma.patient.findFirst({
      where: { patientId, deletedAt: null },
      include: {
        client: true,
        clinicalRecords: { orderBy: { performedAt: "desc" } },
      },
    });
    if (!patient) throw new ApiError(404, "Patient not found");

    return NextResponse.json({ patient });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("patients:write");
    const patientId = await getPatientId(params);
    const data = await parseBody(request, patientUpdateSchema);

    const existing = await prisma.patient.findFirst({
      where: { patientId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, "Patient not found");

    const patient = await prisma.patient.update({
      where: { patientId },
      data,
    });
    await writeAudit(session, {
      action: "update",
      entity: "patient",
      entityId: patientId,
      changes: data,
    });
    return NextResponse.json({ patient });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("patients:write");
    const patientId = await getPatientId(params);

    const existing = await prisma.patient.findFirst({
      where: { patientId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, "Patient not found");

    // Soft-delete: never hard-delete patient records.
    await prisma.patient.update({
      where: { patientId },
      data: { deletedAt: new Date() },
    });
    await writeAudit(session, {
      action: "delete",
      entity: "patient",
      entityId: patientId,
      changes: { softDelete: true },
    });
    return NextResponse.json({ ok: true });
  });
}
