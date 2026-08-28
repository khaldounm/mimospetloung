import { NextResponse } from "next/server";
import { handle, parseBody, parseId, requirePermission } from "@/lib/api";
import {
  getSupplier,
  getSupplierDetail,
  recordSupplierCredit,
} from "@/lib/suppliers";
import { writeAudit } from "@/lib/audit";
import { supplierCreditSchema } from "@/schemas/supplier";

// Records a credit note the supplier issued, spread across the orders it
// settles. Separate from the payments route because it is not one entry: a note
// for a lump sum becomes one settlement row per allocation, written together.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const supplierId = parseId((await params).supplierId, "supplier id");
    const data = await parseBody(request, supplierCreditSchema);

    const paymentIds = await recordSupplierCredit(
      supplierId,
      data,
      session.user.userId,
    );

    // One entry for the note as a whole. The allocations are in the payload, so
    // the history shows what the credit was and where every part of it went.
    await writeAudit(session, {
      action: "create",
      entity: "supplier_payment",
      entityId: paymentIds[0],
      changes: { creditNote: data, paymentIds },
    });

    const detail = await getSupplierDetail(supplierId);
    return NextResponse.json(
      {
        payments: detail?.payments ?? [],
        supplier: await getSupplier(supplierId),
      },
      { status: 201 },
    );
  });
}
