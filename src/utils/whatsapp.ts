import { CLINIC } from "@/constants/clinic";
import { formatMoney } from "@/utils/format";
import type { InvoiceDTO, PurchaseOrderDTO } from "@/types/entities";

// Composes the WhatsApp message body (caption) for an invoice summary.
export function invoiceWhatsAppMessage(invoice: InvoiceDTO): string {
  const lines = [
    CLINIC.name,
    "",
    `Invoice ${invoice.number}`,
    `Total: ${formatMoney(invoice.total)}`,
    `Paid: ${formatMoney(invoice.amountPaid)}`,
    `Balance due: ${formatMoney(invoice.balance)}`,
  ];
  if (invoice.dueDate) lines.push(`Due date: ${invoice.dueDate}`);
  lines.push("", "Thank you for your visit.");
  return lines.join("\n");
}

// Composes the WhatsApp message body (caption) sent to a supplier with a
// purchase order PDF. Addressed to the contact by name when there is one, since
// a company's number is often answered by whoever is nearest.
//
// The item count is included but the lines are not: the PDF is the order, and a
// long caption buries the attachment on a phone screen.
export function orderWhatsAppMessage(
  order: PurchaseOrderDTO,
  contactName?: string | null,
): string {
  const reference = order.reference || `PO-${order.orderId}`;
  const lineCount = order.lines?.length ?? order.lineCount;
  const lines = [
    contactName ? `Hello ${contactName},` : "Hello,",
    "",
    `Please find our purchase order ${reference} attached.`,
    `Items: ${lineCount}`,
    `Total: ${formatMoney(order.total)}`,
  ];
  if (order.notes) lines.push("", order.notes);
  lines.push("", "Thank you,", CLINIC.name);
  return lines.join("\n");
}
