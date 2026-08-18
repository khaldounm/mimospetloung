import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { toDateOnly } from "@/utils/format";
import type { ClientDTO, PatientDTO } from "@/types/entities";
import ClientDetail from "@/components/clients/ClientDetail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await auth();
  const canWrite = hasPermission(session?.user, "patients:write");

  const client = await prisma.client.findFirst({
    where: { clientId: id, deletedAt: null },
    include: {
      patients: { where: { deletedAt: null }, orderBy: { name: "asc" } },
    },
  });
  if (!client) notFound();

  const dto: ClientDTO = {
    clientId: client.clientId,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
  };

  const patients: PatientDTO[] = client.patients.map((p) => ({
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
  }));

  return <ClientDetail client={dto} patients={patients} canWrite={canWrite} />;
}
