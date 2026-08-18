import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseId, requirePermission } from "@/lib/api";
import { getSupplier } from "@/lib/suppliers";
import { writeAudit } from "@/lib/audit";

// Soft delete, matching partner payouts: a mistyped payment is corrected by
// removing it and entering a new one, and the original stays on record.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ supplierId: string; paymentId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const { supplierId: rawSupplier, paymentId: rawPayment } = await params;
    const supplierId = parseId(rawSupplier, "supplier id");
    const paymentId = parseId(rawPayment, "payment id");

    const existing = await prisma.supplierPayment.findFirst({
      where: { paymentId, supplierId, deletedAt: null },
      select: { paymentId: true },
    });
    if (!existing) throw new ApiError(404, "Payment not found");

    await prisma.supplierPayment.update({
      where: { paymentId },
      data: { deletedAt: new Date() },
    });
    await writeAudit(session, {
      action: "delete",
      entity: "supplier_payment",
      entityId: paymentId,
      changes: { softDelete: true, supplierId },
    });

    return NextResponse.json({ supplier: await getSupplier(supplierId) });
  });
}
