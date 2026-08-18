import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { patientInclude, toPatientDTO } from "@/lib/patients";
import { patientCreateSchema } from "@/schemas/patient";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("patients:read");

    const q = new URL(request.url).searchParams.get("q")?.trim();
    const patients = await prisma.patient.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { species: { contains: q, mode: "insensitive" } },
                { breed: { contains: q, mode: "insensitive" } },
                { microchipId: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      include: patientInclude,
    });

    return NextResponse.json({ patients: patients.map(toPatientDTO) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("patients:write");
    const data = await parseBody(request, patientCreateSchema);

    // The owning client must exist and not be soft-deleted.
    const client = await prisma.client.findFirst({
      where: { clientId: data.clientId, deletedAt: null },
    });
    if (!client) throw new ApiError(400, "clientId: owner not found");

    const patient = await prisma.patient.create({ data });
    await writeAudit(session, {
      action: "create",
      entity: "patient",
      entityId: patient.patientId,
      changes: data,
    });
    return NextResponse.json({ patient }, { status: 201 });
  });
}
