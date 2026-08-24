import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSeeCost, hasPermission } from "@/lib/permissions";
import { toInventoryItemDTO } from "@/lib/inventory";
import { getOrderDetail } from "@/lib/purchase-orders";
import { getActiveSuppliers, getSupplierContacts } from "@/lib/suppliers";
import OrderDetail from "@/components/orders/OrderDetail";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await auth();
  const canWrite = hasPermission(session?.user, "orders:write");
  // Receiving moves stock, so it needs the inventory permission too.
  const canReceive = hasPermission(session?.user, "inventory:write");

  const [order, items, suppliers] = await Promise.all([
    getOrderDetail(id),
    prisma.inventoryItem.findMany({
      where: { deletedAt: null },
      include: {
        partner: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    getActiveSuppliers(),
  ]);
  if (!order) notFound();

  // Sequential because it depends on which supplier the order turned out to
  // belong to. One indexed lookup, and only when there is a supplier at all.
  const supplierContacts =
    order.supplierId != null ? await getSupplierContacts(order.supplierId) : [];

  return (
    <OrderDetail
      initialOrder={order}
      supplierContacts={supplierContacts}
      // Purchasing legitimately needs cost, and canSeeCost is the same
      // orders:read gate this page already sits behind.
      items={items.map((i) => toInventoryItemDTO(i, canSeeCost(session?.user)))}
      suppliers={suppliers}
      canWrite={canWrite}
      canReceive={canReceive}
    />
  );
}
