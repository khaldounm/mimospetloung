// String-literal unions mirroring the CHECK constraints in the database schema.
// The DB enforces these via CHECK; these types give the app compile-time safety
// and a single source of allowed values for UI dropdowns + Zod validation.

export const PATIENT_SEXES = ["Male", "Female", "Unknown"] as const;
export type PatientSex = (typeof PATIENT_SEXES)[number];

export const RECORD_TYPES = [
  "Consultation",
  "Vaccination",
  "Grooming",
  "Treatment",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const BOOKING_STATUSES = [
  "Scheduled",
  "Confirmed",
  "Checked In",
  "Completed",
  "Cancelled",
  "No Show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const INVENTORY_TX_TYPES = [
  "Received",
  "Used",
  "Sold",
  "Adjusted",
  "Expired",
] as const;
export type InventoryTxType = (typeof INVENTORY_TX_TYPES)[number];

// Lifecycle of a reorder sheet. Draft is the "future order" the low-stock
// basket fills; Placed means sent to the supplier; Partial means some of it has
// arrived and the rest is still expected; Received means fully settled, whether
// everything turned up or the order was closed short. Cancelled is terminal and
// never touches stock.
export const PURCHASE_ORDER_STATUSES = [
  "Draft",
  "Placed",
  "Partial",
  "Received",
  "Cancelled",
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const INVOICE_STATUSES = [
  "Draft",
  "Issued",
  "Partial",
  "Paid",
  "Overdue",
  "Void",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = [
  "Cash",
  "Card",
  "Bank Transfer",
  "Other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const NOTIFICATION_CHANNELS = ["WhatsApp", "SMS", "Email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = [
  "Pending",
  "Sent",
  "Delivered",
  "Failed",
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

// Lifecycle states for a recall reminder. Open recalls surface in the
// Notifications tabs; Done / Dismissed are terminal and hidden. The time bucket
// (due / upcoming / overdue) is derived from the due date, not stored here.
export const REMINDER_STATUSES = ["Open", "Done", "Dismissed"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const AUDIT_ACTIONS = ["INSERT", "UPDATE", "DELETE"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Triage lifecycle for inbound website contact messages. New on arrival, Read
// once a staff member opens it, Archived when handled.
export const CONTACT_MESSAGE_STATUSES = ["New", "Read", "Archived"] as const;
export type ContactMessageStatus = (typeof CONTACT_MESSAGE_STATUSES)[number];
