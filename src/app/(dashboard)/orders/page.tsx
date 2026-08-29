import {
  getOrders,
  getOrderTotals,
  ORDER_PAGE_SIZE,
} from "@/lib/purchase-orders";
import { getActiveSuppliers } from "@/lib/suppliers";
import OrdersTable from "@/components/orders/OrdersTable";

// Drafts change as the low-stock basket is filled; always render fresh.
export const dynamic = "force-dynamic";

// The working view, and the only one the page renders without being asked.
const INITIAL_FILTER = "Open";

export default async function OrdersPage() {
  // Suppliers come down with the page so starting an order by hand needs no
  // round trip before the dialog can be filled in.
  //
  // Orders arrive one page at a time and already filtered: the tab strip and
  // the pager both re-query rather than sorting through a copy of the whole
  // order book in the browser.
  const [page, totals, suppliers] = await Promise.all([
    getOrders({ status: INITIAL_FILTER, page: 1 }),
    getOrderTotals(),
    getActiveSuppliers(),
  ]);

  return (
    <OrdersTable
      initialOrders={page.orders}
      initialTotal={page.total}
      initialFilter={INITIAL_FILTER}
      pageSize={ORDER_PAGE_SIZE}
      totals={totals}
      suppliers={suppliers}
    />
  );
}
