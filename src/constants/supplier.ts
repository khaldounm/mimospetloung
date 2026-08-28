// How a settlement against a supplier account was made. Both kinds reduce what
// the clinic owes, which is why they live in one table, but only a Payment is
// cash leaving the clinic.
//
// A Credit is the supplier writing something off: goods the clinic sent back, a
// billing error they accepted, an end-of-quarter rebate. It settles a bill
// without any money moving, so every figure that answers "how much did we
// spend" has to exclude it while every figure that answers "what do we owe"
// has to include it.
export const SUPPLIER_SETTLEMENT_KINDS = ["Payment", "Credit"] as const;

export type SupplierSettlementKind = (typeof SUPPLIER_SETTLEMENT_KINDS)[number];

export const DEFAULT_SETTLEMENT_KIND: SupplierSettlementKind = "Payment";

// What the clinic calls each kind on screen. "Credit note" rather than "Credit"
// because that is the document the supplier hands over, and the word on its own
// is ambiguous with being in credit on the account.
export const SETTLEMENT_KIND_LABEL: Record<SupplierSettlementKind, string> = {
  Payment: "Payment",
  Credit: "Credit note",
};
