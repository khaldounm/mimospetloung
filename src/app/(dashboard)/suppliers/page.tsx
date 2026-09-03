import { liveSession } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { canSeePayables, hasPermission } from "@/lib/permissions";
import { getSuppliersWithStats } from "@/lib/suppliers";
import SuppliersTable from "@/components/suppliers/SuppliersTable";

// Item counts move as stock is tagged; always render fresh.
export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const session = await liveSession();
  const canWrite = hasPermission(session?.user, "orders:write");
  // Balances and the owed totals are accounts payable, not purchasing.
  const showMoney = canSeePayables(session?.user);

  const [suppliers, unassignedItemCount] = await Promise.all([
    getSuppliersWithStats(showMoney),
    prisma.inventoryItem.count({
      where: { deletedAt: null, supplierId: null },
    }),
  ]);

  return (
    <SuppliersTable
      initialSuppliers={suppliers}
      unassignedItemCount={unassignedItemCount}
      canWrite={canWrite}
      showMoney={showMoney}
    />
  );
}
