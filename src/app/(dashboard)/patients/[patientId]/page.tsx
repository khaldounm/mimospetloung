import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { toDateOnly } from "@/utils/format";
import type {
  ClinicalRecordDTO,
  PatientDTO,
  ServicePickerOption,
} from "@/types/entities";
import type { RecordType } from "@/types/enums";
import PatientDetail from "@/components/patients/PatientDetail";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const id = Number(patientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await auth();
  const canWritePatient = hasPermission(session?.user, "patients:write");
  const canReadClinical = hasPermission(session?.user, "clinical:read");
  const canWriteClinical = hasPermission(session?.user, "clinical:write");

  const [patient, rawServices] = await Promise.all([
    prisma.patient.findFirst({
      where: { patientId: id, deletedAt: null },
      include: {
        client: { select: { clientId: true, firstName: true, lastName: true } },
        clinicalRecords: {
          where: { deletedAt: null },
          orderBy: { performedAt: "desc" },
          include: {
            performer: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      select: { serviceId: true, name: true, category: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!patient) notFound();

  const services: ServicePickerOption[] = rawServices;

  const dto: PatientDTO = {
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
  };

  const records: ClinicalRecordDTO[] = canReadClinical
    ? patient.clinicalRecords.map((r) => ({
        recordId: r.recordId,
        recordType: r.recordType as RecordType,
        subcategory: r.subcategory,
        title: r.title,
        notes: r.notes,
        details: (r.details as Record<string, unknown> | null) ?? null,
        performedAt: toDateOnly(r.performedAt) ?? "",
        nextDueDate: toDateOnly(r.nextDueDate),
        performerName: r.performer
          ? `${r.performer.firstName} ${r.performer.lastName}`
          : null,
      }))
    : [];

  return (
    <PatientDetail
      patient={dto}
      clientName={`${patient.client.firstName} ${patient.client.lastName}`}
      initialRecords={records}
      services={services}
      canWritePatient={canWritePatient}
      canReadClinical={canReadClinical}
      canWriteClinical={canWriteClinical}
    />
  );
}
