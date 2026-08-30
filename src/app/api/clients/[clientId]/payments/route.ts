import { NextResponse } from "next/server";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { recordAccountPayment } from "@/lib/payments";
import { toPaymentDTO } from "@/lib/invoices";
import { writeAudit } from "@/lib/audit";
import { getFxRate } from "@/lib/settings";
import { accountPaymentCreateSchema } from "@/schemas/client";

async function getClientId(params: Promise<{ clientId: string }>) {
  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

// Money paid against the account itself. The customer who comes in only to
// clear old debt has no invoice to settle, and inventing one would raise the
// balance by the same amount the payment takes off it.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  return handle(async () => {
    // Same permission as taking money on an invoice: it is the same money.
    const session = await requirePermission("payments:write");
    const clientId = await getClientId(params);
    const data = await parseBody(request, accountPaymentCreateSchema);

    // Read server-side, never sent by the browser: a client-supplied rate would
    // let a bad or stale page decide what a lira is worth.
    const fxRate = await getFxRate();

    const { payments, amount, balanceBefore, balanceAfter } =
      await recordAccountPayment(clientId, {
        tenders: data.tenders,
        fxRate,
        method: data.method,
        reference: data.reference,
        paidAt: data.paidAt,
        notes: data.notes,
      });

    // One audit row per currency leg, matching the payment rows themselves.
    for (const payment of payments) {
      await writeAudit(session, {
        action: "payment",
        entity: "payment",
        entityId: payment.paymentId,
        changes: {
          clientId,
          onAccount: true,
          amount: payment.amount.toString(),
          currency: payment.currency,
          amountOriginal: payment.amountOriginal.toString(),
          fxRate: payment.fxRate?.toString() ?? null,
          method: data.method,
          balanceBefore: balanceBefore.toFixed(2),
          balanceAfter: balanceAfter.toFixed(2),
        },
      });
    }

    return NextResponse.json(
      {
        payments: payments.map(toPaymentDTO),
        amount: amount.toFixed(2),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
      },
      { status: 201 },
    );
  });
}
