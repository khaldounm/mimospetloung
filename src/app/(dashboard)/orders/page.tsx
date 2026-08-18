import { getOrders } from "@/lib/purchase-orders";
import OrdersTable from "@/components/orders/OrdersTable";

// Drafts change as the low-stock basket is filled; always render fresh.
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await getOrders();

  return <OrdersTable initialOrders={orders} />;
}
