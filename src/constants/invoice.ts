import type { InvoiceStatus } from "@/types/enums";

// Receipt page width in millimetres. The printed page IS this wide (auto height),
// the industry-standard receipt format: 80 for a desk receipt printer, 58 for a
// pocket roll. Save-as-PDF produces a clean narrow slip at this width.
export const RECEIPT_WIDTH_MM = 80;

// MUI Chip colors for each invoice status, used across the list and detail views.
export const INVOICE_STATUS_COLOR: Record<
  InvoiceStatus,
  "default" | "info" | "warning" | "success" | "error"
> = {
  Draft: "default",
  Issued: "info",
  Partial: "warning",
  Paid: "success",
  Overdue: "error",
  Void: "default",
};

// How far back the register close can reach. The count belongs to the day it
// covers, so the window is a grace period for a day nobody got to, not a way to
// re-open the books.
export const REGISTER_MAX_DAYS_BACK = 7;
