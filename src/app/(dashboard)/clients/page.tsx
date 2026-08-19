import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listClients } from "@/lib/clients";
import ClientsTable from "@/components/clients/ClientsTable";

export default async function ClientsPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "patients:write");

  // First page only. Paging, search and the letter filter all run in SQL.
  const { clients, total, pageSize, letters, reviewCount } = await listClients({
    page: 1,
  });

  return (
    <ClientsTable
      initialClients={clients}
      initialTotal={total}
      pageSize={pageSize}
      letters={letters}
      initialReviewCount={reviewCount}
      canWrite={canWrite}
    />
  );
}
