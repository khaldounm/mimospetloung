import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
  getInventoryCategories,
  listInventory,
  INVENTORY_PAGE_SIZE,
} from "@/lib/inventory";
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

  // No category in the path means every category, still one page at a time.
  const [page, categories, suppliers] = await Promise.all([
    listInventory({ supplier: requested, page: 1 }),
    getInventoryCategories(),
    canViewSuppliers ? getActiveSuppliers() : Promise.resolve([]),
  ]);

  return (
    <InventoryTable
      initialItems={page.items}
      initialTotal={page.total}
      pageSize={INVENTORY_PAGE_SIZE}
      categories={categories}
      activeCategory={null}
      canWrite={canWrite}
      canViewSuppliers={canViewSuppliers}
      canCreateSuppliers={canPurchase}
      canOrder={canPurchase}
      suppliers={suppliers}
      initialSupplierFilter={requested ?? ""}
    />
  );
}
