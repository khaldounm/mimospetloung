// Audit action verbs recorded in audit_log.action (VarChar(20)). Kept short.
export const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "issue",
  "void",
  "payment",
  "stock",
  "send",
  "cancel",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Entity names recorded in audit_log.entity (VarChar(50)). Mirror table names so
// entity + entityId can be traced straight back to a row.
export const AUDIT_ENTITIES = [
  "client",
  "patient",
  "clinical_record",
  "booking",
  "inventory_item",
  "inventory_transaction",
  "service",
  "invoice",
  "invoice_line_item",
  "payment",
  "notification",
  "notification_template",
  "reminder",
  "user",
  "running_cost",
  "partner",
  "partner_payout",
  "supplier",
  "supplier_payment",
  "purchase_order",
  "purchase_order_line",
  "contact_message",
] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

// Human-readable labels for the audit viewer filters / table.
export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  client: "Client",
  patient: "Patient",
  clinical_record: "Clinical record",
  booking: "Booking",
  inventory_item: "Inventory item",
  inventory_transaction: "Stock movement",
  service: "Service",
  invoice: "Invoice",
  invoice_line_item: "Invoice line",
  payment: "Payment",
  notification: "Notification",
  notification_template: "Template",
  reminder: "Recall reminder",
  user: "User",
  running_cost: "Running cost",
  partner: "Partner",
  partner_payout: "Partner payout",
  supplier: "Supplier",
  supplier_payment: "Supplier payment",
  purchase_order: "Purchase order",
  purchase_order_line: "Purchase order line",
  contact_message: "Website message",
};

// MUI Chip colors per action for the viewer.
export const AUDIT_ACTION_COLOR: Record<
  AuditAction,
  "default" | "info" | "warning" | "success" | "error"
> = {
  create: "success",
  update: "info",
  delete: "error",
  issue: "success",
  void: "error",
  payment: "success",
  stock: "info",
  send: "info",
  cancel: "warning",
};
