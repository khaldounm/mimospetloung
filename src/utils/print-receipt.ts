import { CLINIC, SECONDARY_CURRENCY } from "@/constants/clinic";
import { RECEIPT_WIDTH_MM } from "@/constants/invoice";
import { formatMoney, formatSecondaryMoney } from "@/utils/format";
import { printHtmlDocument } from "@/utils/print-document";
import type { InvoiceDTO } from "@/types/entities";

// Escapes a value for safe interpolation into the receipt HTML.
function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(value: string | number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Builds a minimal receipt centered on an A4 page. Prints cleanly on any
// printer and saves as a shareable PDF, with no corner-clustering.
function receiptHtml(invoice: InvoiceDTO): string {
  const now = new Date();
  const stamp = now.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const discountValue = Number(invoice.discountValue);
  const hasDiscount = discountValue !== 0;
  // A flat discount described as a percentage reads as a rounding error, and
  // the reverse hides the figure that was actually agreed at the counter.
  const discountLabel =
    Number(invoice.discountAmount) > 0
      ? "Discount"
      : `Discount (${invoice.discountPct}%)`;
  const hasTax = Number(invoice.taxPct) > 0;
  const adjustment = Number(invoice.adjustment);
  // Lines the clinic consumed rather than sold never reach the customer's copy.
  const lineItems = invoice.lineItems.filter((l) => !l.isHidden);
  const accountBalance =
    invoice.clientBalance != null ? Number(invoice.clientBalance) : null;

  const rows = lineItems
    .map(
      (l) => `
      <tr>
        <td class="qty">${esc(Number(l.quantity))}</td>
        <td class="desc">${esc(l.description)}</td>
        <td class="num">${num(l.unitPrice)}</td>
        <td class="num">${num(l.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const totalsRow = (label: string, value: string, strong = false) => `
    <div class="totline${strong ? " strong" : ""}">
      <span>${esc(label)}</span><span>${esc(value)}</span>
    </div>`;

  const addr = CLINIC.addressLines
    .filter(Boolean)
    .map((l) => `<div>${esc(l)}</div>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${esc(invoice.number)}</title>
<style>
  /* Industry-standard receipt: the page IS the receipt, an 80mm roll cut to the
     length of the content, so Save-as-PDF yields a clean narrow slip rather
     than a strip stranded on an A4 sheet. The height cannot be written here
     because it is not known until the receipt has rendered: printHtmlDocument
     measures it and appends the real @page rule. */
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${RECEIPT_WIDTH_MM}mm;
    font-family: "Courier New", monospace;
    color: #000;
  }
  .receipt {
    padding: 6mm 4mm;
    font-size: 12px;
    line-height: 1.45;
  }
  .center { text-align: center; }
  .name { font-size: 16px; font-weight: bold; }
  .muted { color: #000; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 1px 0; vertical-align: top; font-weight: normal; }
  thead th { text-align: left; border-bottom: 1px dashed #000; padding-bottom: 3px; }
  .qty { width: 12%; }
  .desc { width: 46%; word-break: break-word; }
  .num { width: 21%; text-align: right; }
  th.num { text-align: right; }
  .totline { display: flex; justify-content: space-between; }
  .totline.strong { font-weight: bold; font-size: 14px; margin-top: 4px; }
  .foot { margin-top: 10px; text-align: center; }
  .heart { color: #000; }
</style>
</head>
<body>
  <div class="receipt">
  <div class="center">
    <div class="name">${esc(CLINIC.name)}</div>
    ${addr}
    ${CLINIC.phone ? `<div>${esc(CLINIC.phone)}</div>` : ""}
    ${CLINIC.website ? `<div>${esc(CLINIC.website)}</div>` : ""}
  </div>

  <div class="sep"></div>
  <div>${esc(stamp)}</div>
  <div><strong>INVOICE# ${esc(invoice.number)}</strong></div>
  <div>Bill to: ${esc(invoice.clientName)}</div>

  <div class="sep"></div>
  <table>
    <thead>
      <tr>
        <th class="qty">Qty</th>
        <th class="desc">Description</th>
        <th class="num">Price</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="sep"></div>
  ${totalsRow("Subtotal", formatMoney(invoice.subtotal))}
  ${hasDiscount ? totalsRow(discountLabel, `-${formatMoney(discountValue)}`) : ""}
  ${hasTax ? totalsRow(`Tax (${invoice.taxPct}%)`, formatMoney(invoice.taxAmount)) : ""}
  ${
    /* The rounding the counter agreed to, shown rather than folded into the
       total: a customer told "call it 100" should see the 1.12 come off. */
    adjustment !== 0
      ? totalsRow(
          "Adjustment",
          `${adjustment > 0 ? "+" : "-"}${formatMoney(Math.abs(adjustment))}`,
        )
      : ""
  }
  ${totalsRow("TOTAL", formatMoney(invoice.total), true)}
  ${
    /* Lira at the rate frozen when the invoice was issued, so a reprint shows
       what the customer actually handed over. Drafts have no rate yet. */
    invoice.fxRate
      ? totalsRow(
          `TOTAL ${SECONDARY_CURRENCY.code}`,
          formatSecondaryMoney(invoice.total, Number(invoice.fxRate)),
          true,
        )
      : ""
  }
  ${totalsRow("Paid", formatMoney(invoice.amountPaid))}
  ${totalsRow("Balance due", formatMoney(invoice.balance), true)}
  ${
    /* What the client owes across their WHOLE account, this invoice included.
       A different number from the balance above whenever anything else is
       outstanding, which is the reason for printing it: the customer standing
       at the counter can settle the lot. Absent on a walk-in. */
    accountBalance != null
      ? `<div class="sep"></div>` +
        totalsRow(
          accountBalance < 0 ? "Account in credit" : "Account balance",
          formatMoney(Math.abs(accountBalance)),
          true,
        )
      : ""
  }

  <div class="sep"></div>
  <div>Items# ${lineItems.length}</div>

  <div class="foot">
    <div><span class="heart">&#9829;</span> Thank you for your visit</div>
  </div>
  </div>
</body>
</html>`;
}

// Renders the invoice as a thermal receipt and sends it to the printer. On a
// counter browser launched with kiosk printing it goes straight to the roll.
export function printInvoiceReceipt(invoice: InvoiceDTO): void {
  printHtmlDocument(receiptHtml(invoice), { rollWidthMm: RECEIPT_WIDTH_MM });
}
