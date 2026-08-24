import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  handle,
  parseBody,
  parseId,
  requirePermission,
} from "@/lib/api";
import { getOrderDetail } from "@/lib/purchase-orders";
import { sendDocumentViaWhatsApp } from "@/lib/notifications";
import { signPdfToken } from "@/lib/pdf-token";
import { orderWhatsAppMessage } from "@/utils/whatsapp";
import { normalizePhone } from "@/utils/phone";
import { writeAudit } from "@/lib/audit";
import { orderWhatsAppSchema } from "@/schemas/purchase-order";

export const runtime = "nodejs";

// Sends the purchase order PDF to one of the supplier's contacts via
// WaSenderApi, which fetches the file from a short-lived, token-signed public
// URL.
//
// Gated on orders:write rather than notifications:write: this is a purchasing
// action addressed to a supplier, not client messaging, and orders:write is
// already what "manage suppliers and purchase orders" means.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const orderId = parseId((await params).orderId, "order id");
    const { contactId } = await parseBody(request, orderWhatsAppSchema);

    const order = await getOrderDetail(orderId);
    if (!order) throw new ApiError(404, "Order not found");
    if (order.supplierId == null) {
      throw new ApiError(
        400,
        "Set a supplier on this order before sending it.",
      );
    }
    // A cancelled order is not an instruction to supply anything.
    if (order.status === "Cancelled") {
      throw new ApiError(400, "This order was cancelled and cannot be sent.");
    }

    // Scoped to the order's supplier so a contact id from another company
    // cannot be used to send them someone else's order and costs.
    const contact = await prisma.supplierContact.findFirst({
      where: { contactId, supplierId: order.supplierId },
    });
    if (!contact) {
      throw new ApiError(404, "That contact is not on this supplier.");
    }

    const recipient = normalizePhone(contact.phone);
    if (!recipient) {
      throw new ApiError(
        400,
        `${contact.name} has no valid WhatsApp number on file.`,
      );
    }

    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("host");
    if (!host) throw new ApiError(500, "Unable to resolve public URL");
    const token = signPdfToken("order", orderId);
    const documentUrl = `${proto}://${host}/api/public/orders/${orderId}/pdf?token=${token}`;
    const reference = order.reference || `PO-${order.orderId}`;

    const messageId = await sendDocumentViaWhatsApp(
      recipient,
      documentUrl,
      `${reference}.pdf`,
      orderWhatsAppMessage(order, contact.name),
    );

    // The contact's name and number are recorded here rather than only as an
    // id, so the history survives the contact later being removed.
    await writeAudit(session, {
      action: "send",
      entity: "purchase_order",
      entityId: orderId,
      changes: {
        channel: "whatsapp",
        contactId: contact.contactId,
        contactName: contact.name,
        recipient,
        messageId,
      },
    });

    return NextResponse.json({ ok: true, messageId, sentTo: contact.name });
  });
}
