import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSuppliersWithStats } from "@/lib/suppliers";
import SuppliersTable from "@/components/suppliers/SuppliersTable";

// Item counts move as stock is tagged; always render fresh.
export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "orders:write");

  const [suppliers, unassignedItemCount] = await Promise.all([
    getSuppliersWithStats(),
    prisma.inventoryItem.count({
      where: { deletedAt: null, supplierId: null },
    }),
  ]);

  return (
    <SuppliersTable
      initialSuppliers={suppliers}
      unassignedItemCount={unassignedItemCount}
      canWrite={canWrite}
    />
  );
}
