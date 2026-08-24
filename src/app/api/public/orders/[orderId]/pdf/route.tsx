import { renderToBuffer } from "@react-pdf/renderer";
import { getOrderDetail } from "@/lib/purchase-orders";
import { verifyPdfToken } from "@/lib/pdf-token";
import { CLINIC } from "@/constants/clinic";
import OrderPdfDocument from "@/components/orders/OrderPdfDocument";

// PDF rendering needs the Node runtime (fontkit / Buffer), not the edge.
export const runtime = "nodejs";

// Public, token-authorized purchase order PDF. WaSenderApi fetches this URL to
// attach the file to a WhatsApp message, so it must work without a user
// session. The signed token (see lib/pdf-token) binds the kind, the order id
// and an expiry, so an invoice token cannot be replayed here.
//
// This document shows supplier cost, which is Admin-only inside the app. That
// is deliberate: the recipient is the supplier who quoted those costs, and the
// link dies in fifteen minutes.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Invalid id", { status: 400 });
  }

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!verifyPdfToken("order", id, token)) {
    return new Response("Forbidden", { status: 403 });
  }

  const order = await getOrderDetail(id);
  if (!order) return new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const buffer = await renderToBuffer(
    <OrderPdfDocument order={order} logoSrc={`${origin}${CLINIC.logo.src}`} />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${order.reference || `PO-${order.orderId}`}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
