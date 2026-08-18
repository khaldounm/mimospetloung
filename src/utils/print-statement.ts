import { AGING_BUCKETS } from "@/constants/statement";
import { formatDate, formatDateTime, formatMoney } from "@/utils/format";
import { formatRangeLabel } from "@/utils/date-range";
import type { StatementDTO, StatementSupplierDTO } from "@/types/entities";

// Renders the supplier statement as a printable document, separate from the
// on-screen page so the output is a clean record rather than a screenshot of an
// app. Built as its own HTML in a hidden iframe, matching printInvoiceReceipt.
//
// Deliberately audit-shaped: the header states who, what period, as at when and
// when it was produced; every balance is derived on the page from the documents
// listed beneath it; and the reconciliation line says out loud whether the
// figures tie.

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );

const money = (v: string | number) => escape(formatMoney(v));

function supplierBlock(s: StatementSupplierDTO): string {
  const lines = s.lines.length
    ? s.lines
        .map(
          (l) => `
      <tr>
        <td>${escape(formatDate(l.date))}</td>
        <td>${escape(l.reference)}</td>
        <td>${escape(l.description)}</td>
        <td class="num">${Number(l.charge) ? money(l.charge) : ""}</td>
        <td class="num">${Number(l.payment) ? money(l.payment) : ""}</td>
        <td class="num">${money(l.balance)}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" class="muted">No activity in this period.</td></tr>`;

  return `
  <section class="supplier">
    <h2>${escape(s.supplierName)}</h2>
    <table class="ledger">
      <thead>
        <tr>
          <th>Date</th><th>Reference</th><th>Description</th>
          <th class="num">Charges</th><th class="num">Payments</th><th class="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr class="opening">
          <td colspan="5">Balance brought forward</td>
          <td class="num">${money(s.openingBalance)}</td>
        </tr>
        ${lines}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3">Period movement</td>
          <td class="num">${money(s.billed)}</td>
          <td class="num">${money(s.paid)}</td>
          <td class="num"></td>
        </tr>
        <tr class="closing">
          <td colspan="5">Balance carried forward</td>
          <td class="num">${money(s.closingBalance)}</td>
        </tr>
      </tfoot>
    </table>
    ${
      s.ties
        ? ""
        : `<p class="warn">This account does not reconcile: the listed documents
           do not sum to the closing balance. Investigate before relying on it.</p>`
    }
    <table class="aging">
      <thead><tr>${AGING_BUCKETS.map((b) => `<th class="num">${escape(b.label)}</th>`).join("")}</tr></thead>
      <tbody><tr>${AGING_BUCKETS.map((b) => `<td class="num">${money(s.aging[b.id] ?? "0")}</td>`).join("")}</tr></tbody>
    </table>
  </section>`;
}

function statementHtml(statement: StatementDTO): string {
  const { totals } = statement;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Supplier statement ${escape(statement.range.from)} to ${escape(statement.range.to)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 10pt; color: #111; margin: 0;
  }
  header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 15pt; margin: 0 0 2px; }
  h2 { font-size: 11pt; margin: 0 0 6px; }
  .clinic { font-size: 11pt; font-weight: 600; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 24px; margin-top: 6px; font-size: 9pt; color: #444; }
  .meta div span { color: #111; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 6px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
  th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .03em; color: #444; border-bottom: 1px solid #999; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: #777; font-style: italic; }
  /* Keep a supplier's ledger and its aging on one page where it fits, so a
     balance is never read apart from the documents behind it. */
  .supplier { break-inside: avoid; margin-bottom: 16px; }
  .supplier h2 { border-bottom: 1px solid #111; padding-bottom: 3px; }
  .ledger .opening td, .ledger .closing td { font-weight: 600; background: #f4f4f4; }
  .ledger tfoot td { border-top: 1px solid #999; }
  .aging { margin-top: 6px; width: auto; }
  .aging th, .aging td { border-bottom: none; padding: 2px 10px 2px 0; }
  .summary { margin-bottom: 18px; }
  .summary td, .summary th { border-bottom: 1px solid #999; }
  .summary tfoot td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; }
  .warn { color: #a00; font-weight: 600; font-size: 9pt; margin: 4px 0 0; }
  footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #999; font-size: 8.5pt; color: #444; }
  .sign { margin-top: 22px; display: flex; gap: 40px; }
  .sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; }
</style>
</head>
<body>
<header>
  <div class="clinic">${escape(statement.clinicName)}</div>
  <h1>Supplier statement &mdash; accounts payable</h1>
  <div class="meta">
    <div>Period: <span>${escape(formatRangeLabel(statement.range))}</span></div>
    <div>Balances as at: <span>${escape(formatDate(statement.asAt))}</span></div>
    <div>Currency: <span>${escape(statement.currency)}</span></div>
    <div>Generated: <span>${escape(formatDateTime(statement.generatedAt))}</span></div>
    <div>Accounts: <span>${totals.supplierCount}</span></div>
  </div>
</header>

<h2>Summary</h2>
<table class="summary">
  <thead>
    <tr>
      <th>Supplier</th>
      <th class="num">Opening</th>
      <th class="num">Charges</th>
      <th class="num">Payments</th>
      <th class="num">Closing</th>
    </tr>
  </thead>
  <tbody>
    ${statement.suppliers
      .map(
        (s) => `<tr>
      <td>${escape(s.supplierName)}</td>
      <td class="num">${money(s.openingBalance)}</td>
      <td class="num">${money(s.billed)}</td>
      <td class="num">${money(s.paid)}</td>
      <td class="num">${money(s.closingBalance)}</td>
    </tr>`,
      )
      .join("")}
  </tbody>
  <tfoot>
    <tr>
      <td>Total</td>
      <td class="num">${money(totals.openingBalance)}</td>
      <td class="num">${money(totals.billed)}</td>
      <td class="num">${money(totals.paid)}</td>
      <td class="num">${money(totals.closingBalance)}</td>
    </tr>
  </tfoot>
</table>

<h2>Aged payables as at ${escape(formatDate(statement.asAt))}</h2>
<table class="summary">
  <thead><tr>${AGING_BUCKETS.map((b) => `<th class="num">${escape(b.label)}</th>`).join("")}<th class="num">Total</th></tr></thead>
  <tbody><tr>${AGING_BUCKETS.map((b) => `<td class="num">${money(totals.aging[b.id] ?? "0")}</td>`).join("")}<td class="num">${money(totals.closingBalance)}</td></tr></tbody>
</table>

${statement.suppliers.map(supplierBlock).join("")}

<footer>
  <div>
    Opening balance plus charges less payments equals the closing balance on every
    account and in total.
    ${
      totals.ties
        ? "These figures reconcile."
        : "<strong>These figures do not reconcile. One or more documents are missing.</strong>"
    }
  </div>
  <div>
    A charge is recognised on the date its purchase order was fully received or
    closed short. Aging applies payments to the oldest charge first.
  </div>
  <div class="sign">
    <div>Prepared by</div>
    <div>Reviewed by</div>
  </div>
</footer>
</body>
</html>`;
}

export function printSupplierStatement(statement: StatementDTO): void {
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
  doc.write(statementHtml(statement));
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
