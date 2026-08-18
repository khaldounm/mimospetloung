import type { ClientDTO } from "@/types/entities";

// Relations to pull when a client is rendered with its active patient count.
export const clientInclude = {
  _count: { select: { patients: { where: { deletedAt: null } } } },
} as const;

// Shape returned by the client queries (using `clientInclude`). Mapping to a
// flat DTO here keeps the API response and the server-rendered page identical,
// so the client table doesn't lose the patient count when it refetches.
type ClientWithCount = {
  clientId: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  _count: { patients: number };
};

export function toClientDTO(c: ClientWithCount): ClientDTO {
  return {
    clientId: c.clientId,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    patientCount: c._count.patients,
  };
}
