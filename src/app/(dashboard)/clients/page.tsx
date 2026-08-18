import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { clientInclude, toClientDTO } from "@/lib/clients";
import ClientsTable from "@/components/clients/ClientsTable";

export default async function ClientsPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "patients:write");

  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: clientInclude,
  });

  const initialClients = clients.map(toClientDTO);

  return <ClientsTable initialClients={initialClients} canWrite={canWrite} />;
}
