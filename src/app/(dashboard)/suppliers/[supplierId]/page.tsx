import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
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

  const session = await auth();
  const canWrite = hasPermission(session?.user, "orders:write");

  // The two tables arrive a page at a time; the pickers get every payable bill
  // but as four fields each rather than a whole purchase order.
  const [detail, payableOrders] = await Promise.all([
    getSupplierDetail(id),
    getPayableOrders(id),
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
    />
  );
}
