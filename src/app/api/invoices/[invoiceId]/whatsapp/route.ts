import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, requirePermission } from "@/lib/api";
import { invoiceInclude, toInvoiceDTO } from "@/lib/invoices";
import { sendDocumentViaWhatsApp } from "@/lib/notifications";
import { signInvoicePdfToken } from "@/lib/pdf-token";
import { invoiceWhatsAppMessage } from "@/utils/whatsapp";
import { normalizePhone } from "@/utils/phone";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Sends the invoice PDF to the client's WhatsApp number via WaSenderApi. The
// provider fetches the file from a short-lived, token-signed public URL.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("notifications:write");

    const { invoiceId } = await params;
    const id = Number(invoiceId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError(400, "Invalid id");
    }

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId: id },
      include: invoiceInclude,
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");

    const dto = toInvoiceDTO(invoice);
    const recipient = normalizePhone(dto.clientPhone);
    if (!recipient) {
      throw new ApiError(400, "This client has no valid phone number on file.");
    }

    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("host");
    if (!host) throw new ApiError(500, "Unable to resolve public URL");
    const token = signInvoicePdfToken(id);
    const documentUrl = `${proto}://${host}/api/public/invoices/${id}/pdf?token=${token}`;

    const messageId = await sendDocumentViaWhatsApp(
      recipient,
      documentUrl,
      `${dto.number}.pdf`,
      invoiceWhatsAppMessage(dto),
    );

    await writeAudit(session, {
      action: "send",
      entity: "invoice",
      entityId: id,
      changes: { channel: "whatsapp", recipient, messageId },
    });

    return NextResponse.json({ ok: true, messageId });
  });
}
