import { getOrders } from "@/lib/purchase-orders";
import { getActiveSuppliers } from "@/lib/suppliers";
import OrdersTable from "@/components/orders/OrdersTable";

// Drafts change as the low-stock basket is filled; always render fresh.
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  // Suppliers come down with the page so starting an order by hand needs no
  // round trip before the dialog can be filled in.
  const [orders, suppliers] = await Promise.all([
    getOrders(),
    getActiveSuppliers(),
  ]);

  return <OrdersTable initialOrders={orders} suppliers={suppliers} />;
}
