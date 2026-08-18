import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { patientInclude, toPatientDTO } from "@/lib/patients";
import PatientsTable from "@/components/patients/PatientsTable";
import type { ClientOption } from "@/components/patients/PatientFormDialog";

export default async function PatientsPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "patients:write");

  const [patients, clients] = await Promise.all([
    prisma.patient.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: patientInclude,
    }),
    prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { clientId: true, firstName: true, lastName: true },
    }),
  ]);

  const initialPatients = patients.map(toPatientDTO);

  const clientOptions: ClientOption[] = clients.map((c) => ({
    clientId: c.clientId,
    label: `${c.firstName} ${c.lastName}`,
  }));

  return (
    <PatientsTable
      initialPatients={initialPatients}
      clientOptions={clientOptions}
      canWrite={canWrite}
    />
  );
}
