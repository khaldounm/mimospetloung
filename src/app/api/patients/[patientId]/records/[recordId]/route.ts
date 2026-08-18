import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { upsertRecallReminder } from "@/lib/reminders";
import { clinicalRecordUpdateSchema } from "@/schemas/clinical-record";
import type { RecordType } from "@/types/enums";

async function getIds(
  params: Promise<{ patientId: string; recordId: string }>,
) {
  const { patientId, recordId } = await params;
  const pid = Number(patientId);
  const rid = Number(recordId);
  if (!Number.isInteger(pid) || pid <= 0)
    throw new ApiError(400, "Invalid patientId");
  if (!Number.isInteger(rid) || rid <= 0)
    throw new ApiError(400, "Invalid recordId");
  return { pid, rid };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ patientId: string; recordId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("clinical:write");
    const { pid, rid } = await getIds(params);
    const body = await parseBody(request, clinicalRecordUpdateSchema);

    const existing = await prisma.clinicalRecord.findFirst({
      where: { recordId: rid, patientId: pid, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, "Record not found");

    const { details, ...rest } = body;

    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.clinicalRecord.update({
        where: { recordId: rid },
        data: {
          ...rest,
          ...(details !== undefined
            ? { details: details as Prisma.InputJsonValue }
            : {}),
        },
      });

      if (updated.nextDueDate) {
        await upsertRecallReminder(tx, {
          patientId: pid,
          recordType: updated.recordType as RecordType,
          title: updated.subcategory ?? updated.title,
          dueDate: updated.nextDueDate,
          sourceRecordId: updated.recordId,
        });
      }

      return updated;
    });

    await writeAudit(session, {
      action: "update",
      entity: "clinical_record",
      entityId: rid,
      changes: body,
    });

    return NextResponse.json({ record });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ patientId: string; recordId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("clinical:write");
    const { pid, rid } = await getIds(params);

    const existing = await prisma.clinicalRecord.findFirst({
      where: { recordId: rid, patientId: pid, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, "Record not found");

    await prisma.clinicalRecord.update({
      where: { recordId: rid },
      data: { deletedAt: new Date() },
    });

    await writeAudit(session, {
      action: "delete",
      entity: "clinical_record",
      entityId: rid,
      changes: { patientId: pid },
    });

    return NextResponse.json({ ok: true });
  });
}
