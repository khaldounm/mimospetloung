import { CLINIC } from "@/constants/clinic";
import { formatMoney } from "@/utils/format";
import type { InvoiceDTO } from "@/types/entities";

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
