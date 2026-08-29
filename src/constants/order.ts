import type { PurchaseOrderStatus } from "@/types/enums";

// Heading for the bucket that collects items with no usual supplier. These
// orders cannot be placed until a supplier is chosen, so the label reads as a
// state rather than a name.
export const NO_SUPPLIER_LABEL = "No supplier assigned";

// VAT charged on supplier bills. One rate across the whole bill, confirmed by
// the clinic. Only the default: each order stores the rate that applied to it,
// so changing this leaves past orders alone.
export const DEFAULT_VAT_RATE = 11;

// How a discount typed on a delivery is read: a flat amount off the unit cost,
// or a percentage of it. Stored nowhere: the discount reduces the unit cost and
// the net figure is what books, so the order total, the supplier balance and the
// item's cost price all follow it without any of them knowing a discount was
// taken.
export const DISCOUNT_UNITS = ["amount", "percent"] as const;

export type DiscountUnit = (typeof DISCOUNT_UNITS)[number];

export const DEFAULT_DISCOUNT_UNIT: DiscountUnit = "amount";

// Everything still in flight. Partial belongs here: part of it has arrived and
// the rest is expected, so it is the most open an order can be. Leaving it out
// hid such orders from every tab at once.
export const OPEN_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "Draft",
  "Placed",
  "Partial",
];

// What the tab strip on the orders list offers. "Open" is the working view and
// is not a stored status: it stands for OPEN_ORDER_STATUSES.
export type OrderStatusFilter = "Open" | PurchaseOrderStatus;

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

// Heading for the bucket that collects items with no category set. Like
// NO_SUPPLIER_LABEL it reads as a state rather than a shelf name, because that
// is what it is: nobody has said which product line these belong to.
export const UNCATEGORISED_ORDER_LABEL = "No category";
