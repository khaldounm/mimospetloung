import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/utils/format";
import { toClinicalRecordDTO } from "@/lib/patients";
import type { MedicalRecordDTO } from "@/types/entities";

// Assembles a patient's full clinical history into the shape the medical
// record PDF prints. Both the in-app download and the public (token-signed)
// endpoint that WaSenderApi fetches go through here, so the client receives
// exactly the document staff previewed.
//
// Records are ordered oldest first: a history reads as a timeline, unlike the
// on-screen list which puts the most recent visit at the top.
export async function getMedicalRecord(
  patientId: number,
): Promise<MedicalRecordDTO | null> {
  const patient = await prisma.patient.findFirst({
    where: { patientId, deletedAt: null },
    include: {
      client: {
        select: { firstName: true, lastName: true, phone: true, phone2: true },
      },
      clinicalRecords: {
        where: { deletedAt: null },
        orderBy: [{ performedAt: "asc" }, { recordId: "asc" }],
        include: { performer: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!patient) return null;

  return {
    patient: {
      patientId: patient.patientId,
      clientId: patient.clientId,
      name: patient.name,
      species: patient.species,
      breed: patient.breed,
      dateOfBirth: toDateOnly(patient.dateOfBirth),
      sex: patient.sex,
      isNeutered: patient.isNeutered,
      microchipId: patient.microchipId,
      notes: patient.notes,
      needsReview: patient.needsReview,
      reviewNote: patient.reviewNote,
      clientName: `${patient.client.firstName} ${patient.client.lastName}`,
    },
    clientName: `${patient.client.firstName} ${patient.client.lastName}`,
    // Falls back to the second number: for many imported clients that is the
    // one that actually reaches them.
    clientPhone: patient.client.phone ?? patient.client.phone2 ?? null,
    records: patient.clinicalRecords.map(toClinicalRecordDTO),
    generatedAt: new Date().toISOString(),
  };
}
