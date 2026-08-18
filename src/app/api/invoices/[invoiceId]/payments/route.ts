import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { recordPayment, toInvoiceDTO, toPaymentDTO } from "@/lib/invoices";
import { writeAudit } from "@/lib/audit";
import { paymentCreateSchema } from "@/schemas/invoice";

async function getInvoiceId(params: Promise<{ invoiceId: string }>) {
  const { invoiceId } = await params;
  const id = Number(invoiceId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    await requirePermission("invoices:read");
    const invoiceId = await getInvoiceId(params);

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId },
      select: { invoiceId: true },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");

    const payments = await prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paidAt: "asc" },
    });

    return NextResponse.json({ payments: payments.map(toPaymentDTO) });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    // Recording money is gated by the dedicated payments:write permission.
    const session = await requirePermission("payments:write");
    const invoiceId = await getInvoiceId(params);
    const data = await parseBody(request, paymentCreateSchema);

    const { invoice, payment } = await recordPayment(invoiceId, {
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      paidAt: data.paidAt,
      notes: data.notes,
    });

    await writeAudit(session, {
      action: "payment",
      entity: "payment",
      entityId: payment.paymentId,
      changes: { invoiceId, amount: data.amount, method: data.method },
    });

    return NextResponse.json(
      { invoice: toInvoiceDTO(invoice), payment: toPaymentDTO(payment) },
      { status: 201 },
    );
  });
}
