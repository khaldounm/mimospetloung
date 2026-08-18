import type { PurchaseOrderStatus } from "@/types/enums";

// Heading for the bucket that collects items with no usual supplier. These
// orders cannot be placed until a supplier is chosen, so the label reads as a
// state rather than a name.
export const NO_SUPPLIER_LABEL = "No supplier assigned";

// VAT charged on supplier bills. One rate across the whole bill, confirmed by
// the clinic. Only the default: each order stores the rate that applied to it,
// so changing this leaves past orders alone.
export const DEFAULT_VAT_RATE = 11;

// MUI Chip colors per order status.
export const ORDER_STATUS_COLOR: Record<
  PurchaseOrderStatus,
  "default" | "info" | "warning" | "success" | "error"
> = {
  Draft: "default",
  Placed: "info",
  Partial: "warning",
  Received: "success",
  Cancelled: "error",
};
