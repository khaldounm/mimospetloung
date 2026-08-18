import { toDateOnly } from "@/utils/format";
import type { PatientDTO } from "@/types/entities";

// Relations to pull when a patient is rendered with its owner's name.
export const patientInclude = {
  client: { select: { firstName: true, lastName: true } },
} as const;

// Shape returned by the patient queries (using `patientInclude`). Mapping to a
// flat DTO here keeps the API response and the server-rendered page identical,
// so the client table doesn't lose the owner name when it refetches.
type PatientWithClient = {
  patientId: number;
  clientId: number;
  name: string;
  species: string | null;
  breed: string | null;
  dateOfBirth: Date | null;
  sex: string | null;
  isNeutered: boolean;
  microchipId: string | null;
  notes: string | null;
  client: { firstName: string; lastName: string };
};

export function toPatientDTO(p: PatientWithClient): PatientDTO {
  return {
    patientId: p.patientId,
    clientId: p.clientId,
    name: p.name,
    species: p.species,
    breed: p.breed,
    dateOfBirth: toDateOnly(p.dateOfBirth),
    sex: p.sex,
    isNeutered: p.isNeutered,
    microchipId: p.microchipId,
    notes: p.notes,
    clientName: `${p.client.firstName} ${p.client.lastName}`,
  };
}
