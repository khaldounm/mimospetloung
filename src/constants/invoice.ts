import type { InvoiceStatus } from "@/types/enums";

// Receipt page width in millimetres. This is the PRINTABLE width, not the width
// of the paper: an 80mm roll on the XP-80C only exposes 72.1mm of print area,
// which is what its driver means by "80(72.1) x 297 mm". Rendering at 80 and
// leaving the driver to squeeze that into 72.1 downscales every glyph by about
// a tenth, which is what made the first slips look thin and smeared. Matching
// the printable width prints one to one. Measure a new printer before changing
// this: the number to use is the smaller one in the driver's paper size.
export const RECEIPT_WIDTH_MM = 72;

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
