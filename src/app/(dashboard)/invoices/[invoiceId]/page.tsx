import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { invoiceInclude, toInvoiceDTO, toServiceDTO } from "@/lib/invoices";
import { toInventoryItemDTO } from "@/lib/inventory";
import InvoiceDetail from "@/components/invoices/InvoiceDetail";
import type { ClientOption } from "@/components/invoices/InvoiceFormDialog";
import type {
  ItemLineOption,
  ServiceLineOption,
} from "@/components/invoices/LineItemDialog";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const id = Number(invoiceId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await auth();
  const canWrite = hasPermission(session?.user, "invoices:write");
  const canPay = hasPermission(session?.user, "payments:write");

  const [invoice, clients, services, items] = await Promise.all([
    prisma.invoice.findUnique({
      where: { invoiceId: id },
      include: invoiceInclude,
    }),
    prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { clientId: true, firstName: true, lastName: true },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryItem.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!invoice) notFound();

  const clientOptions: ClientOption[] = clients.map((c) => ({
    clientId: c.clientId,
    label: `${c.firstName} ${c.lastName}`,
  }));

  const serviceOptions: ServiceLineOption[] = services
    .map(toServiceDTO)
    .map((s) => ({ serviceId: s.serviceId, name: s.name, price: s.price }));

  const itemOptions: ItemLineOption[] = items
    .map(toInventoryItemDTO)
    .map((i) => ({
      itemId: i.itemId,
      name: i.name,
      barcode: i.barcode,
      salePrice: i.salePrice,
      currentStock: i.currentStock,
      unit: i.unit,
    }));

  return (
    <InvoiceDetail
      invoice={toInvoiceDTO(invoice)}
      clientOptions={clientOptions}
      serviceOptions={serviceOptions}
      itemOptions={itemOptions}
      canWrite={canWrite}
      canPay={canPay}
    />
  );
}
