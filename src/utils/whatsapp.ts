import { CLINIC } from "@/constants/clinic";
import { formatMoney } from "@/utils/format";
import type {
  InvoiceDTO,
  MedicalRecordDTO,
  PurchaseOrderDTO,
} from "@/types/entities";

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

// Composes the WhatsApp message body (caption) sent to an owner with their
// pet's medical record PDF. The history itself stays in the attachment: a
// caption long enough to list visits pushes the file off a phone screen.
export function medicalRecordWhatsAppMessage(record: MedicalRecordDTO): string {
  const { patient, records } = record;
  const lines = [
    `Hello ${record.clientName},`,
    "",
    `Please find ${patient.name}'s medical record attached.`,
    `Entries: ${records.length}`,
  ];

  // The next recall is the one thing worth repeating outside the PDF, since it
  // is the only part that asks the owner to do something.
  const today = new Date().toISOString().slice(0, 10);
  const nextDue = records
    .map((r) => r.nextDueDate)
    .filter((d): d is string => !!d && d >= today)
    .sort()[0];
  if (nextDue) lines.push(`Next due: ${nextDue}`);

  lines.push("", "Thank you,", CLINIC.name);
  return lines.join("\n");
}

// Filename-safe slug of a pet's name, so the attachment arrives as
// "medical-record-luna.pdf" rather than an id the owner cannot read.
export function medicalRecordFileName(record: MedicalRecordDTO): string {
  const slug = record.patient.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `medical-record-${slug || record.patient.patientId}.pdf`;
}
