import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listPatients } from "@/lib/patients";
import PatientsTable from "@/components/patients/PatientsTable";

export default async function PatientsPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "patients:write");

  // First page only. Paging, search and the letter filter all run in SQL, and
  // the owner list the create dialog needs is fetched when that dialog opens.
  const { patients, total, pageSize, letters } = await listPatients({
    page: 1,
  });

  return (
    <PatientsTable
      initialPatients={patients}
      initialTotal={total}
      pageSize={pageSize}
      letters={letters}
      canWrite={canWrite}
    />
  );
}
