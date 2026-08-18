import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { upsertRecallReminder } from "@/lib/reminders";
import { clinicalRecordCreateSchema } from "@/schemas/clinical-record";

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
    await requirePermission("clinical:read");
    const patientId = await getPatientId(params);

    const records = await prisma.clinicalRecord.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { performedAt: "desc" },
      include: {
        performer: { select: { firstName: true, lastName: true } },
      },
    });
    return NextResponse.json({ records });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("clinical:write");
    const patientId = await getPatientId(params);
    const body = await parseBody(request, clinicalRecordCreateSchema);

    const patient = await prisma.patient.findFirst({
      where: { patientId, deletedAt: null },
    });
    if (!patient) throw new ApiError(404, "Patient not found");

    const { details, performedBy, ...rest } = body;
    // Create the record and keep its recall reminder in sync atomically: a
    // vaccination / grooming record with a nextDueDate materialises (or
    // refreshes) the patient's single Open recall in the same transaction, so
    // the Notifications tabs read a small indexed table and never drift from
    // the source record.
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.clinicalRecord.create({
        data: {
          ...rest,
          patientId,
          details: details as Prisma.InputJsonValue,
          // Default the performer to the signed-in user.
          performedBy: performedBy ?? session.user.userId,
        },
      });

      if (created.nextDueDate) {
        await upsertRecallReminder(tx, {
          patientId,
          recordType: created.recordType as (typeof body)["recordType"],
          title: created.subcategory ?? created.title,
          dueDate: created.nextDueDate,
          sourceRecordId: created.recordId,
        });
      }

      return created;
    });
    await writeAudit(session, {
      action: "create",
      entity: "clinical_record",
      entityId: record.recordId,
      changes: { patientId, ...rest },
    });
    return NextResponse.json({ record }, { status: 201 });
  });
}
