import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { listPatients, patientInclude, toPatientDTO } from "@/lib/patients";
import { patientCreateSchema } from "@/schemas/patient";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("patients:read");

    const sp = new URL(request.url).searchParams;
    const pageRaw = sp.get("page")?.trim();

    // Paged and filtered in SQL; the response also carries the letter buckets
    // so the jump bar reflects the data rather than a hardcoded alphabet.
    const page = await listPatients({
      q: sp.get("q")?.trim() || undefined,
      letter: sp.get("letter")?.trim() || undefined,
      page: pageRaw ? Number(pageRaw) : 1,
      needsReview: sp.get("review") === "1",
    });

    return NextResponse.json(page);
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
