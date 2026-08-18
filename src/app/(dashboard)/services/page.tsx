import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { toServiceDTO } from "@/lib/invoices";
import ServicesTable from "@/components/invoices/ServicesTable";

export default async function ServicesPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "invoices:write");

  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });

  return (
    <ServicesTable
      initialServices={services.map(toServiceDTO)}
      canWrite={canWrite}
    />
  );
}
