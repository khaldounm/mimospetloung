import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  handle,
  parseBody,
  parseId,
  requirePermission,
} from "@/lib/api";
import {
  getSupplier,
  supplierPaymentInclude,
  toSupplierPaymentDTO,
} from "@/lib/suppliers";
import { writeAudit } from "@/lib/audit";
import { supplierPaymentCreateSchema } from "@/schemas/supplier";

async function getSupplierId(params: Promise<{ supplierId: string }>) {
  return parseId((await params).supplierId, "supplier id");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  return handle(async () => {
    await requirePermission("orders:read");
    const supplierId = await getSupplierId(params);

    const payments = await prisma.supplierPayment.findMany({
      where: { supplierId, deletedAt: null },
      include: supplierPaymentInclude,
      orderBy: [{ paidOn: "desc" }, { paymentId: "desc" }],
    });

    return NextResponse.json({ payments: payments.map(toSupplierPaymentDTO) });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const supplierId = await getSupplierId(params);
    const data = await parseBody(request, supplierPaymentCreateSchema);

    const supplier = await prisma.supplier.findFirst({
      where: { supplierId, deletedAt: null },
      select: { supplierId: true },
    });
    if (!supplier) throw new ApiError(404, "Supplier not found");

    // A linked order must belong to this supplier, or the balance would credit
    // one account for a bill on another.
    if (data.orderId != null) {
      const order = await prisma.purchaseOrder.findFirst({
        where: { orderId: data.orderId, supplierId, deletedAt: null },
        select: { orderId: true, status: true },
      });
      if (!order) {
        throw new ApiError(404, "That order does not belong to this supplier");
      }
      if (order.status !== "Received") {
        throw new ApiError(
          409,
          `That order is ${order.status.toLowerCase()}, so there is nothing to pay against it yet. Leave the order blank to pay against the account instead.`,
        );
      }
    }

    const payment = await prisma.supplierPayment.create({
      data: {
        supplierId,
        orderId: data.orderId ?? null,
        amount: data.amount,
        paidOn: data.paidOn,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        createdBy: session.user.userId,
      },
      include: supplierPaymentInclude,
    });
    await writeAudit(session, {
      action: "create",
      entity: "supplier_payment",
      entityId: payment.paymentId,
      changes: data,
    });

    return NextResponse.json(
      {
        payment: toSupplierPaymentDTO(payment),
        supplier: await getSupplier(supplierId),
      },
      { status: 201 },
    );
  });
}
