import { CLINIC } from "@/constants/clinic";
import { RECEIPT_WIDTH_MM } from "@/constants/invoice";
import { formatMoney } from "@/utils/format";
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

  const discountAmount =
    (Number(invoice.subtotal) * Number(invoice.discountPct)) / 100;
  const hasDiscount = Number(invoice.discountPct) > 0;
  const hasTax = Number(invoice.taxPct) > 0;

  const rows = invoice.lineItems
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
  /* Industry-standard receipt: the page IS the receipt (80mm roll, auto height),
     so Save-as-PDF yields a clean narrow slip, not a strip lost on an A4 sheet. */
  @page { size: ${RECEIPT_WIDTH_MM}mm auto; margin: 0; }
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
  ${
    hasDiscount
      ? totalsRow(
          `Discount (${invoice.discountPct}%)`,
          `-${formatMoney(discountAmount)}`,
        )
      : ""
  }
  ${hasTax ? totalsRow(`Tax (${invoice.taxPct}%)`, formatMoney(invoice.taxAmount)) : ""}
  ${totalsRow("TOTAL", formatMoney(invoice.total), true)}
  ${totalsRow("Paid", formatMoney(invoice.amountPaid))}
  ${totalsRow("Balance due", formatMoney(invoice.balance), true)}

  <div class="sep"></div>
  <div>Items# ${invoice.lineItems.length}</div>

  <div class="foot">
    <div><span class="heart">&#9829;</span> Thank you for your visit</div>
  </div>
  </div>
</body>
</html>`;
}

// Renders the invoice as a thermal receipt and opens the browser print dialog.
// Uses a hidden iframe so the current page is untouched.
export function printInvoiceReceipt(invoice: InvoiceDTO): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(receiptHtml(invoice));
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };

  win.onafterprint = cleanup;
  win.focus();
  win.print();
  // Fallback removal in case onafterprint never fires.
  setTimeout(cleanup, 60000);
}
