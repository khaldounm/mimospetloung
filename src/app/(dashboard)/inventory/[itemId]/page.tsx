import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { toInventoryItemDTO, toInventoryTransactionDTO } from "@/lib/inventory";
import InventoryDetail from "@/components/inventory/InventoryDetail";

export default async function InventoryItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await auth();
  const canWrite = hasPermission(session?.user, "inventory:write");
  const canViewSuppliers = hasPermission(session?.user, "orders:read");
  const canCreateSuppliers = hasPermission(session?.user, "orders:write");

  const item = await prisma.inventoryItem.findFirst({
    where: { itemId: id, deletedAt: null },
    include: {
      partner: { select: { name: true } },
      supplier: { select: { name: true } },
      transactions: {
        orderBy: { performedAt: "desc" },
        include: { performer: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!item) notFound();

  return (
    <InventoryDetail
      item={toInventoryItemDTO(item)}
      initialTransactions={item.transactions.map(toInventoryTransactionDTO)}
      canWrite={canWrite}
      canViewSuppliers={canViewSuppliers}
      canCreateSuppliers={canCreateSuppliers}
      canOrder={canCreateSuppliers}
    />
  );
}
