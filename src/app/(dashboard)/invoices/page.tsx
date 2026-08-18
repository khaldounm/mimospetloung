import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { invoiceListInclude, toInvoiceListItemDTO } from "@/lib/invoices";
import InvoicesTable from "@/components/invoices/InvoicesTable";
import type { ClientOption } from "@/components/invoices/InvoiceFormDialog";

export default async function InvoicesPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "invoices:write");

  const [invoices, clients] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: invoiceListInclude,
    }),
    prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { clientId: true, firstName: true, lastName: true },
    }),
  ]);

  const clientOptions: ClientOption[] = clients.map((c) => ({
    clientId: c.clientId,
    label: `${c.firstName} ${c.lastName}`,
  }));

  return (
    <InvoicesTable
      initialInvoices={invoices.map(toInvoiceListItemDTO)}
      clientOptions={clientOptions}
      canWrite={canWrite}
    />
  );
}
