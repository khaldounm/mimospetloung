// The invoice money model in plain numbers, for the browser.
//
// The server does this same arithmetic in Prisma.Decimal (computeTotals in
// @/lib/invoices) and its answer is the one that gets stored. This exists so a
// dialog can show what a discount or a rounding will come to BEFORE it is
// saved, which is the whole point of typing "make it 100": you have to be able
// to see the 101.12 you are rounding away from.
//
// Keep the two in step. The order matters as much as the figures: discount off
// the subtotal, tax on what is left, adjustment last of all.

export type DiscountMode = "pct" | "amount";

export interface InvoiceMoneyInput {
  subtotal: number;
  discountMode: DiscountMode;
  // Read as a percentage or as money depending on discountMode.
  discountInput: number;
  taxPct: number;
}

export interface InvoiceMoneyPreview {
  // What the discount comes to in money, whichever way it was typed.
  discountValue: number;
  taxAmount: number;
  // The figure before any rounding. This is the number the counter is looking
  // at when it decides to call it 100.
  totalBeforeAdjustment: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function previewInvoiceMoney(
  input: InvoiceMoneyInput,
): InvoiceMoneyPreview {
  const subtotal = round2(input.subtotal);

  // A flat discount is clamped to what there is to discount, matching the
  // server: on a document whose returns outweigh its sales the subtotal is
  // negative, and "$10 off" that would hand the customer ten dollars more back
  // than they ever paid.
  const discountValue =
    input.discountMode === "amount"
      ? round2(
          Math.min(Math.max(input.discountInput, 0), Math.max(subtotal, 0)),
        )
      : round2((subtotal * input.discountInput) / 100);

  const taxable = subtotal - discountValue;
  const taxAmount = round2((taxable * input.taxPct) / 100);

  return {
    discountValue,
    taxAmount,
    totalBeforeAdjustment: round2(taxable + taxAmount),
  };
}

// The delta to store so the invoice lands on `target`. Stored as the delta and
// never as the target, so adding a line afterwards moves the total by that line
// instead of the invoice quietly swallowing it.
export function adjustmentFor(
  totalBeforeAdjustment: number,
  target: number,
): number {
  return round2(target - totalBeforeAdjustment);
}
