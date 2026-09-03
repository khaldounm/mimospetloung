import { notFound } from "next/navigation";
import { liveSession } from "@/lib/session-user";
import { canSeePayables, hasPermission } from "@/lib/permissions";
import {
  getPayableOrders,
  getSupplierDetail,
  SUPPLIER_PAGE_SIZE,
} from "@/lib/suppliers";
import SupplierDetail from "@/components/suppliers/SupplierDetail";

// Balances move as orders are received and payments recorded; render fresh.
export const dynamic = "force-dynamic";

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = await params;
  const id = Number(supplierId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await liveSession();
  const canWrite = hasPermission(session?.user, "orders:write");
  const showMoney = canSeePayables(session?.user);

  // The two tables arrive a page at a time; the pickers get every payable bill
  // but as four fields each rather than a whole purchase order. The payable
  // list is what is still owed on each order, so it is not fetched at all
  // without the permission.
  const [detail, payableOrders] = await Promise.all([
    getSupplierDetail(id, showMoney),
    showMoney ? getPayableOrders(id) : Promise.resolve([]),
  ]);
  if (!detail) notFound();

  return (
    <SupplierDetail
      supplier={detail.supplier}
      initialOrders={detail.orders.orders}
      ordersTotal={detail.orders.total}
      initialPayments={detail.payments.payments}
      paymentsTotal={detail.payments.total}
      pageSize={SUPPLIER_PAGE_SIZE}
      payableOrders={payableOrders}
      canWrite={canWrite}
      showMoney={showMoney}
      canRecordPayments={hasPermission(session?.user, "payables:write")}
    />
  );
}
