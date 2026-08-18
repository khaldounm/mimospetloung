import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { invoiceInclude, toInvoiceDTO } from "@/lib/invoices";
import { verifyInvoicePdfToken } from "@/lib/pdf-token";
import { CLINIC } from "@/constants/clinic";
import InvoicePdfDocument from "@/components/invoices/InvoicePdfDocument";

// PDF rendering needs the Node runtime (fontkit / Buffer), not the edge.
export const runtime = "nodejs";

// Public, token-authorized invoice PDF. WaSenderApi fetches this URL to attach
// the file to a WhatsApp message, so it must work without a user session. The
// signed token (see lib/pdf-token) binds the invoice id and an expiry.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  const id = Number(invoiceId);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Invalid id", { status: 400 });
  }

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!verifyInvoicePdfToken(id, token)) {
    return new Response("Forbidden", { status: 403 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId: id },
    include: invoiceInclude,
  });
  if (!invoice) return new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const logoSrc = `${origin}${CLINIC.logo.src}`;

  const buffer = await renderToBuffer(
    <InvoicePdfDocument invoice={toInvoiceDTO(invoice)} logoSrc={logoSrc} />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${toInvoiceDTO(invoice).number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
