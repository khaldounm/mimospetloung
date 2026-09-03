import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { invoiceInclude, toInvoiceDTO } from "@/lib/invoices";
import { redeemGrant, releaseGrantFromInvoice } from "@/lib/offers";
import { redeemOfferSchema } from "@/schemas/offer";
import { writeAudit } from "@/lib/audit";

async function getInvoiceId(params: Promise<{ invoiceId: string }>) {
  const { invoiceId } = await params;
  const id = Number(invoiceId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

// The updated invoice, so the page redraws its totals off one response rather
// than applying the discount and then refetching to find out what it did.
async function respondWithInvoice(invoiceId: number, extra: object = {}) {
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: invoiceInclude,
  });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  return NextResponse.json({ invoice: toInvoiceDTO(invoice), ...extra });
}

// Spends one of the client's offers on this draft. The discount lands in the
// invoice's own discount columns, so the receipt, the PDF and every total
// downstream need to know nothing about offers.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const invoiceId = await getInvoiceId(params);
    const { grantId } = await parseBody(request, redeemOfferSchema);

    const { replaced } = await redeemGrant(invoiceId, grantId);

    await writeAudit(session, {
      action: "redeem",
      entity: "offer_grant",
      entityId: grantId,
      changes: {
        invoiceId,
        // Named because it is the surprising half: an offer landing on an
        // invoice that already carried a hand-typed discount replaces it, and
        // the log should say what was taken away.
        ...(replaced ? { replacedDiscount: replaced } : {}),
      },
    });

    return respondWithInvoice(invoiceId, { replaced });
  });
}

// Undoes the above: the discount goes back to zero and the client keeps the
// offer to use another day.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const invoiceId = await getInvoiceId(params);

    await releaseGrantFromInvoice(invoiceId);

    await writeAudit(session, {
      action: "update",
      entity: "invoice",
      entityId: invoiceId,
      changes: { offerRemoved: true },
    });

    return respondWithInvoice(invoiceId);
  });
}
