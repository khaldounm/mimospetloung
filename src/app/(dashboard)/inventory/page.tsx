import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { toInventoryItemDTO } from "@/lib/inventory";
import { getActiveSuppliers } from "@/lib/suppliers";
import InventoryTable from "@/components/inventory/InventoryTable";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "inventory:write");
  const canViewSuppliers = hasPermission(session?.user, "orders:read");
  // One permission covers both creating a supplier inline and pushing items
  // into a future order.
  const canPurchase = hasPermission(session?.user, "orders:write");

  // ?supplier= arrives from the item counts on the suppliers page. Resolved
  // here rather than with useSearchParams so the first paint is already
  // filtered and the client needs no Suspense boundary.
  const requested = canViewSuppliers
    ? (await searchParams).supplier
    : undefined;
  const supplierId = Number(requested);
  const supplierFilter =
    requested === "none"
      ? { supplierId: null }
      : requested && Number.isInteger(supplierId)
        ? { supplierId }
        : {};

  const [items, suppliers] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { deletedAt: null, ...supplierFilter },
      include: {
        partner: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    canViewSuppliers ? getActiveSuppliers() : Promise.resolve([]),
  ]);

  const initialItems = items.map(toInventoryItemDTO);

  return (
    <InventoryTable
      initialItems={initialItems}
      canWrite={canWrite}
      canViewSuppliers={canViewSuppliers}
      canCreateSuppliers={canPurchase}
      canOrder={canPurchase}
      suppliers={suppliers}
      initialSupplierFilter={
        Object.keys(supplierFilter).length > 0 ? (requested ?? "") : ""
      }
    />
  );
}
