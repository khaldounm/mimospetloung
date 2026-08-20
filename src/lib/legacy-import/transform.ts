// Step 3: turn the staging tables into app rows.
//
// Idempotent by construction: every insert targets legacy_id and upserts, so
// running this again at cutover against a fresher backup is a delta, not a
// duplicate. Rows whose meaning had to be guessed carry needs_review + a
// review_note explaining what a human should check.

import { prisma } from "@/lib/prisma";
import {
  LEGACY_BALANCE_EPSILON,
  LEGACY_CATEGORY_NAMES,
  LEGACY_DISCOUNT_SERVICE_ID,
  LEGACY_OPENING_BALANCE_DATE,
  LEGACY_OPENING_BALANCE_SOURCE,
  LEGACY_PACK_SIZE,
  LEGACY_SERVICE_EXCLUSIONS,
  LEGACY_SERVICE_PATTERNS,
  LEGACY_STRONG_SERVICE,
  LEGACY_TITLE_PREFIX,
  LEGACY_UNKNOWN_SERVICE_ID,
  LEGACY_WALKIN_CUSTOMER_ID,
  PET_NAME_SEPARATORS,
  PET_NON_NAMES,
} from "@/constants/legacy-import";
import { normalizeLegacyPhone } from "./phone";

type Row = Record<string, string | null>;
const s = (v: string | null | undefined) => (v ?? "").trim();
const num = (v: string | null | undefined) => {
  const n = Number(s(v));
  return Number.isFinite(n) ? n : 0;
};
// UnitPrice is float32 in Access, so values arrive as 34.166599. Money is
// Decimal(12,2) here, and the source's own totals are 2dp.
const money = (v: string | null | undefined) => Math.round(num(v) * 100) / 100;

/** Split a client name: first token is the first name, the rest is the surname. */
export function splitClientName(raw: string): {
  salutation: string | null;
  first: string;
  last: string;
} {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const title = collapsed.match(LEGACY_TITLE_PREFIX);
  const cleaned = title ? collapsed.slice(title[0].length) : collapsed;
  // Normalise "dr" and "DR." to a consistent "Dr." for display.
  const salutation = title
    ? title[1].charAt(0).toUpperCase() + title[1].slice(1).toLowerCase() + "."
    : null;
  const gap = cleaned.indexOf(" ");
  return gap === -1
    ? { salutation, first: cleaned, last: "" }
    : {
        salutation,
        first: cleaned.slice(0, gap),
        last: cleaned.slice(gap + 1),
      };
}

/**
 * Classify a legacy product as a clinic service, or null for retail stock.
 * See the three-pass explanation in @/constants/legacy-import.
 */
export function classifyService(name: string): string | null {
  if (LEGACY_SERVICE_EXCLUSIONS.test(name)) return null;
  for (const [category, pattern] of LEGACY_STRONG_SERVICE) {
    if (pattern.test(name)) return category;
  }
  // A pack size means it came off a shelf.
  if (LEGACY_PACK_SIZE.test(name)) return null;
  for (const [category, pattern] of LEGACY_SERVICE_PATTERNS) {
    if (pattern.test(name)) return category;
  }
  return null;
}

// Chunked parameterised upsert. Kept generic so each entity below reads as a
// mapping rather than as SQL plumbing.
async function upsert(
  table: string,
  cols: string[],
  rows: unknown[][],
  update: string[],
) {
  if (rows.length === 0) return;
  const wrong = rows.findIndex((r) => r.length !== cols.length);
  if (wrong !== -1) {
    throw new Error(
      `${table}: row ${wrong} has ${rows[wrong]?.length} values for ${cols.length} columns`,
    );
  }
  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const params: unknown[] = [];
    const tuples = slice.map((r) => {
      const ph = r.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${ph.join(",")})`;
    });
    const setter = update.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
    const bad = params.findIndex((v) => v === undefined);
    if (bad !== -1) {
      throw new Error(
        `${table}: undefined parameter at position ${bad} (column "${cols[bad % cols.length]}")`,
      );
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")})
       VALUES ${tuples.join(",")}
       ON CONFLICT ("legacy_id") DO UPDATE SET ${setter}`,
      ...params,
    );
  }
}

export async function transform() {
  const q = <T = Row>(sql: string) => prisma.$queryRawUnsafe<T[]>(sql);
  const report: string[] = [];

  // ── Clients ────────────────────────────────────────────────────────────
  const custs = await q(`SELECT * FROM staging.customerwholesale`);
  const clientRows: unknown[][] = [];
  for (const c of custs) {
    const id = num(c.CustomerWSID);
    const raw = s(c.CustWholeSaleName);
    // The walk-in counter account is not a person, but 2,398 invoices point at
    // it and Invoice.client_id is NOT NULL, so it becomes one labelled row.
    if (id === LEGACY_WALKIN_CUSTOMER_ID) {
      clientRows.push([
        id,
        null,
        "Walk-in",
        "",
        null,
        null,
        money(c.WSAccount),
        false,
        "Counter sales from the old system. Not a real client.",
        "Walk-in",
      ]);
      continue;
    }
    if (!raw) continue; // 14 empty shells: no name, no phone, no pets
    const parsed = splitClientName(raw);
    // The old system had its own title field; prefer it when it was filled in.
    const salutation = s(c.BName) || parsed.salutation;
    const { first, last } = parsed;
    const primary = normalizeLegacyPhone(s(c.PhoneNumber));
    const secondary = normalizeLegacyPhone(s(c.FaxNumber));
    // The old "fax" box held a second contact number. Either box may be the only
    // usable one, and a few cells hold two numbers at once.
    const phone = primary.phone ?? secondary.phone;
    const phone2 = primary.phone
      ? (secondary.phone ?? primary.extra)
      : secondary.extra;
    const notes: string[] = [];
    let review: string | null = null;
    if (/^(1|tes+t+|xxx+)$/i.test(raw))
      review = `Looks like a test record ("${raw}").`;
    else review = primary.problem ?? secondary.problem;
    if (s(c.Insured) && s(c.Insured) !== "No")
      notes.push(`Insurance: ${s(c.Insured)}`);
    clientRows.push([
      id,
      salutation ? salutation.slice(0, 20) : null,
      first,
      last,
      phone,
      phone2,
      // The old system's running balance, which carries years this file does
      // not contain, so it is taken as-is rather than recomputed.
      money(c.WSAccount),
      review !== null,
      review,
      notes.join("\n") || null,
    ]);
  }
  await upsert(
    "clients",
    [
      "legacy_id",
      "salutation",
      "first_name",
      "last_name",
      "phone",
      "phone2",
      "account_balance",
      "needs_review",
      "review_note",
      "notes",
    ],
    clientRows,
    [
      "salutation",
      "first_name",
      "last_name",
      "phone",
      "phone2",
      "account_balance",
    ],
  );
  report.push(`clients        ${clientRows.length}`);

  const clientId = new Map<number, number>();
  for (const r of await q<{ legacy_id: number; client_id: number }>(
    `SELECT legacy_id, client_id FROM clients WHERE legacy_id IS NOT NULL`,
  ))
    clientId.set(Number(r.legacy_id), Number(r.client_id));

  // Stripping an embedded title ("Mr.Ramzi Merhi" -> "Ramzi Merhi") can make a
  // record collide with an existing one. Usually that means the clinic entered
  // the same person twice, but not always: the phone numbers sometimes differ.
  // Flag both sides and let a human decide rather than merging automatically.
  const dupes = await prisma.$executeRawUnsafe(`
    UPDATE "clients" c SET "needs_review" = true, "review_note" =
      'Another client has this exact name. Check whether they are the same person before using either record.'
    FROM (SELECT lower(first_name) f, lower(last_name) l
          FROM "clients" WHERE legacy_id IS NOT NULL
          GROUP BY 1,2 HAVING count(*) > 1) d
    WHERE lower(c.first_name) = d.f AND lower(c.last_name) = d.l
      AND c.legacy_id IS NOT NULL AND c."review_note" IS NULL`);
  report.push(
    `duplicates     ${dupes} clients share a name with another client`,
  );

  // ── Patients (pet names typed into the client notes box) ───────────────
  const petRows: unknown[][] = [];
  let flaggedPets = 0;
  for (const c of custs) {
    const id = num(c.CustomerWSID);
    const owner = clientId.get(id);
    const rawNotes = s(c.Notes);
    if (!owner || !rawNotes || id === LEGACY_WALKIN_CUSTOMER_ID) continue;
    const parts = rawNotes
      .split(PET_NAME_SEPARATORS)
      .map((p) => p.trim())
      .filter(Boolean);
    // Newline is the one separator staff used consistently. Anything else in a
    // multi-pet entry is a guess at where one name ends and the next begins.
    const ambiguous = parts.length > 1 && !/[\n\r]/.test(rawNotes);
    parts.forEach((part, idx) => {
      const isDescription = PET_NON_NAMES.has(part.toLowerCase());
      let review: string | null = null;
      if (isDescription)
        review = `Owner record said "${part}" where a pet name should be.`;
      else if (ambiguous)
        review = `Split from "${rawNotes.replace(/\s+/g, " ")}". Confirm the names.`;
      if (review) flaggedPets++;
      petRows.push([
        id * 100 + idx,
        owner,
        isDescription ? "Unnamed pet" : part.slice(0, 100),
        isDescription ? part.toLowerCase() : null,
        review !== null,
        review,
        `Imported from the old system: "${rawNotes.replace(/\s+/g, " ")}"`,
      ]);
    });
  }
  await upsert(
    "patients",
    [
      "legacy_id",
      "client_id",
      "name",
      "species",
      "needs_review",
      "review_note",
      "notes",
    ],
    petRows,
    ["client_id", "name"],
  );
  report.push(`patients       ${petRows.length} (${flaggedPets} flagged)`);

  // ── Products: split into clinic services and retail stock ──────────────
  // Items the clinic actually traded in: sold to a client, or bought from a
  // supplier. The other ~2,250 products are vendor catalogue padding.
  const traded = new Set(
    (
      await q<{ ProductID: string }>(
        `SELECT DISTINCT "ProductID" FROM staging.custinvoicedetails
         UNION SELECT DISTINCT "ProductID" FROM staging.invoice_details`,
      )
    ).map((r: { ProductID: string }) => s(r.ProductID)),
  );
  // Products bought from a supplier need an inventory row so stock can be
  // tracked, even when they are also billed as a service.
  const purchased = new Set(
    (
      await q<{ ProductID: string }>(
        `SELECT DISTINCT "ProductID" FROM staging.invoice_details`,
      )
    ).map((r: { ProductID: string }) => s(r.ProductID)),
  );
  const prods = await q(`SELECT * FROM staging.products`);
  const svcRows: unknown[][] = [],
    invRows: unknown[][] = [];
  const isService = new Map<number, boolean>();
  for (const p of prods) {
    const pid = num(p.ProductID);
    if (!traded.has(s(p.ProductID))) continue;
    const name = s(p.ProductName) || `Product ${pid}`;
    const category = classifyService(name);
    const price = money(p.UnitPrice);
    const review = price === 0 ? "No price recorded in the old system." : null;
    const catId = s(p.CategoryID);
    const stockCategory =
      catId && catId !== "0"
        ? (LEGACY_CATEGORY_NAMES[catId] ?? `Category ${catId}`)
        : null;
    if (category) {
      isService.set(pid, true);
      svcRows.push([
        pid,
        name.slice(0, 255),
        category,
        price,
        review !== null,
        review,
      ]);
      // A vaccine is both: stock the clinic buys and counts, and a service it
      // charges for (the handling fee). It therefore gets an inventory row as
      // well, so purchases and stock levels have somewhere to land. Sales still
      // bill against the service.
      if (purchased.has(s(p.ProductID))) {
        invRows.push([
          pid,
          name.slice(0, 255),
          stockCategory ?? category,
          s(p.Unit) || null,
          price || null,
          money(p.LastInvPrice) || null,
          review !== null,
          review,
        ]);
      }
    } else {
      isService.set(pid, false);
      invRows.push([
        pid,
        name.slice(0, 255),
        // The old catalogue numbered its categories and shipped no names, so
        // the number is carried across for the clinic to rename.
        stockCategory,
        s(p.Unit) || null,
        price || null,
        money(p.LastInvPrice) || null,
        review !== null,
        review,
      ]);
    }
  }
  // invoice_line_items requires every line to point at a service or an item.
  // Two sentinels give the lines that have no product of their own somewhere to
  // attach: the invoice-level discount, and any product missing from the file.
  svcRows.push([
    LEGACY_DISCOUNT_SERVICE_ID,
    "Discount",
    "Adjustment",
    0,
    false,
    null,
  ]);
  svcRows.push([
    LEGACY_UNKNOWN_SERVICE_ID,
    "Unknown legacy product",
    "Adjustment",
    0,
    true,
    "Invoice line referenced a product that is not in the old system's product list.",
  ]);
  await upsert(
    "services",
    ["legacy_id", "name", "category", "price", "needs_review", "review_note"],
    svcRows,
    ["name", "category", "price"],
  );
  await upsert(
    "inventory_items",
    [
      "legacy_id",
      "name",
      "category",
      "unit",
      "sale_price",
      "last_cost",
      "needs_review",
      "review_note",
    ],
    invRows,
    ["name", "category", "unit", "sale_price", "last_cost"],
  );
  report.push(`services       ${svcRows.length}`);
  report.push(`inventory      ${invRows.length}`);

  // ── Suppliers ──────────────────────────────────────────────────────────
  const sups = await q(`SELECT * FROM staging.suppliers`);
  await upsert(
    "suppliers",
    [
      "legacy_id",
      "name",
      "phone",
      "account_balance",
      "needs_review",
      "review_note",
    ],
    sups.map((x: Row) => [
      num(x.SupplierID),
      // One supplier row has no name but does carry a balance, so it gets a
      // placeholder rather than being dropped along with the money it owes.
      (s(x.SupplierName) || `Supplier ${num(x.SupplierID)}`).slice(0, 255),
      normalizeLegacyPhone(s(x.PhoneNumber)).phone,
      // The old system's supplier Account column: what the clinic still owes.
      money(x.Account),
      false,
      null,
    ]),
    ["name", "phone", "account_balance"],
  );
  report.push(`suppliers      ${sups.length}`);

  // ── Supplier opening balances ──────────────────────────────────────────
  // Suppliers.BBack is the balance brought forward from the years before this
  // file. It is NOT extra money owed: Account already contains it
  // (Account = BBack + purchases - payments, exact on 21 of 25 suppliers), so
  // account_balance above is already right and must not be touched here. This
  // row exists so a statement can show where the figure started instead of
  // opening on an unexplained gap.
  const openingRows = sups
    .map((x: Row) => ({ legacyId: num(x.SupplierID), amount: money(x.BBack) }))
    .filter((r) => Math.abs(r.amount) >= LEGACY_BALANCE_EPSILON);

  if (openingRows.length) {
    const params: unknown[] = [];
    const tuples = openingRows.map((r) => {
      params.push(
        r.legacyId,
        r.amount,
        LEGACY_OPENING_BALANCE_DATE,
        LEGACY_OPENING_BALANCE_SOURCE,
        String(r.legacyId),
      );
      const n = params.length;
      return `((SELECT supplier_id FROM suppliers WHERE legacy_id = $${n - 4}),
                $${n - 3}::numeric, $${n - 2}::date, $${n - 1}, $${n})`;
    });
    // DO NOTHING, not DO UPDATE: the row is immutable and a second import must
    // never restate a figure the clinic has already shown someone.
    await prisma.$executeRawUnsafe(
      `INSERT INTO opening_balances
         (supplier_id, amount, as_of_date, source, source_ref)
       VALUES ${tuples.join(",")}
       ON CONFLICT (supplier_id, as_of_date) DO NOTHING`,
      ...params,
    );
  }
  report.push(`sup. opening   ${openingRows.length}`);

  // ── Invoices ───────────────────────────────────────────────────────────
  const invoices = await q(`SELECT * FROM staging.custinvoices`);
  const invRowsOut: unknown[][] = [];
  for (const i of invoices) {
    const owner = clientId.get(num(i.CustomerWSID));
    if (!owner) continue; // 6 invoices point at a client id that does not exist
    invRowsOut.push([
      num(i.CustInvoiceID),
      owner,
      "Paid",
      money(i.AmountInv),
      money(i.AmountInv),
      s(i.CustInvoiceDate) || null,
      false,
      null,
    ]);
  }
  await upsert(
    "invoices",
    [
      "legacy_id",
      "client_id",
      "status",
      "subtotal",
      "total",
      "issued_at",
      "needs_review",
      "review_note",
    ],
    invRowsOut,
    ["client_id", "subtotal", "total", "issued_at"],
  );
  report.push(`invoices       ${invRowsOut.length}`);

  const invoiceId = new Map<number, number>();
  for (const r of await q<{ legacy_id: number; invoice_id: number }>(
    `SELECT legacy_id, invoice_id FROM invoices WHERE legacy_id IS NOT NULL`,
  ))
    invoiceId.set(Number(r.legacy_id), Number(r.invoice_id));

  const svcId = new Map<number, number>(),
    itemId = new Map<number, number>();
  for (const r of await q<{ legacy_id: number; service_id: number }>(
    `SELECT legacy_id, service_id FROM services WHERE legacy_id IS NOT NULL`,
  ))
    svcId.set(Number(r.legacy_id), Number(r.service_id));
  for (const r of await q<{ legacy_id: number; item_id: number }>(
    `SELECT legacy_id, item_id FROM inventory_items WHERE legacy_id IS NOT NULL`,
  ))
    itemId.set(Number(r.legacy_id), Number(r.item_id));

  // ── Line items ─────────────────────────────────────────────────────────
  const details = await q(`SELECT * FROM staging.custinvoicedetails`);
  const prodName = new Map<number, string>(
    prods.map((p: Row) => [num(p.ProductID), s(p.ProductName)]),
  );
  const lineRows: unknown[][] = [];
  for (const d of details) {
    const inv = invoiceId.get(num(d.CustInvoiceID));
    if (!inv) continue;
    const pid = num(d.ProductID);
    const svc = isService.get(pid) === true ? (svcId.get(pid) ?? null) : null;
    const item =
      isService.get(pid) === false ? (itemId.get(pid) ?? null) : null;
    const unresolved = svc === null && item === null;
    lineRows.push([
      num(d.CustInvoiceDetailID),
      inv,
      unresolved ? (svcId.get(LEGACY_UNKNOWN_SERVICE_ID) ?? null) : svc,
      item,
      (prodName.get(pid) || `Product ${pid}`).slice(0, 255),
      num(d.Quantity),
      money(d.UnitPrice),
      unresolved,
      unresolved
        ? `Product ${pid} was not found in the old system's product list.`
        : null,
    ]);
  }
  // The old system stored an invoice-level discount as a flat amount. line_total
  // is a generated column here, so the discount becomes its own negative line:
  // the lines still sum to the invoice total and it stays visible when printed.
  let discountLines = 0;
  for (const i of invoices) {
    const disc = money(i.DiscountInv);
    const inv = invoiceId.get(num(i.CustInvoiceID));
    if (!inv || disc <= 0) continue;
    discountLines++;
    lineRows.push([
      -num(i.CustInvoiceID),
      inv,
      svcId.get(LEGACY_DISCOUNT_SERVICE_ID) ?? null,
      null,
      "Discount",
      1,
      -disc,
      false,
      null,
    ]);
  }
  await upsert(
    "invoice_line_items",
    [
      "legacy_id",
      "invoice_id",
      "service_id",
      "item_id",
      "description",
      "quantity",
      "unit_price",
      "needs_review",
      "review_note",
    ],
    lineRows,
    ["invoice_id", "description", "quantity", "unit_price"],
  );
  report.push(
    `line items     ${lineRows.length} (${discountLines} discount lines)`,
  );

  // ── Payments ───────────────────────────────────────────────────────────
  const pays = await q(`SELECT * FROM staging.payments`);
  const payRows: unknown[][] = [];
  // Payments belong to the client's account, exactly as the old system had it:
  // its Payments table carried both a CustomerID and an InvNo, and clients
  // routinely settled several visits at once. The invoice link is kept when it
  // resolves, so an invoice still shows what was paid against it, while the
  // account balance is what really says whether a client owes anything.
  //
  // The app requires a payment to be positive. The file also holds refunds
  // (negative) and zero-value rows, so a refund flags its invoice rather than
  // being dropped silently.
  const refunds = new Map<number, number>();
  let zeroPays = 0;
  let unlinked = 0;
  for (const p of pays) {
    const owner = clientId.get(num(p.CustomerID));
    if (!owner) continue;
    const inv = invoiceId.get(num(p.InvNo)) ?? null;
    if (!inv) unlinked++;
    const amount = money(p.PaymentAmount);
    if (amount < 0) {
      if (inv) refunds.set(inv, (refunds.get(inv) ?? 0) + amount);
      continue;
    }
    if (amount === 0) {
      zeroPays++;
      continue;
    }
    payRows.push([
      num(p.PaymentID),
      owner,
      inv,
      amount,
      s(p.PaymentDate) || null,
      false,
      null,
    ]);
  }
  await upsert(
    "payments",
    [
      "legacy_id",
      "client_id",
      "invoice_id",
      "amount",
      "paid_at",
      "needs_review",
      "review_note",
    ],
    payRows,
    ["client_id", "invoice_id", "amount", "paid_at"],
  );
  report.push(
    `payments       ${payRows.length} (${unlinked} on account only, ${refunds.size} refunds flagged, ${zeroPays} zero-value skipped)`,
  );

  // Flag the invoices that carried a refund.
  for (const [inv, amount] of refunds) {
    await prisma.$executeRawUnsafe(
      `UPDATE "invoices" SET "needs_review" = true, "review_note" = $2 WHERE "invoice_id" = $1`,
      inv,
      `The old system recorded a refund of ${amount.toFixed(2)} against this invoice. Refunds are not imported as payments: confirm how this should be recorded.`,
    );
  }

  // ── Purchases ──────────────────────────────────────────────────────────
  // Supplier accounts read as zero with no orders until this exists: the old
  // system kept purchases in its own Invoices / Invoice Details pair, entirely
  // separate from the customer invoices.
  const supplierId = new Map<number, number>();
  for (const r of await q<{ legacy_id: number; supplier_id: number }>(
    `SELECT legacy_id, supplier_id FROM suppliers WHERE legacy_id IS NOT NULL`,
  ))
    supplierId.set(Number(r.legacy_id), Number(r.supplier_id));

  const purchases = await q(`SELECT * FROM staging.invoices`);
  const poRows: unknown[][] = [];
  for (const p of purchases) {
    poRows.push([
      num(p.InvoiceID),
      supplierId.get(num(p.SupplierID)) ?? null,
      "Received",
      s(p.SupInvoiceNo).slice(0, 100) || null,
      s(p.InvoiceDate) || null,
      s(p.InvoiceDate) || null,
      // A received order must carry a billed date; these are supplier invoices,
      // so the invoice date is exactly that.
      s(p.InvoiceDate) || null,
      // The discount column must be non-negative here; the old file has a few
      // negative values, which are corrections rather than discounts.
      Math.max(0, money(p.InvDiscount)) || null,
    ]);
  }
  await upsert(
    "purchase_orders",
    [
      "legacy_id",
      "supplier_id",
      "status",
      "reference",
      "ordered_on",
      "received_on",
      "billed_on",
      "discount_amount",
    ],
    poRows,
    [
      "supplier_id",
      "reference",
      "ordered_on",
      "received_on",
      "billed_on",
      "discount_amount",
    ],
  );
  report.push(`purchase orders ${poRows.length}`);

  const orderId = new Map<number, number>();
  for (const r of await q<{ legacy_id: number; order_id: number }>(
    `SELECT legacy_id, order_id FROM purchase_orders WHERE legacy_id IS NOT NULL`,
  ))
    orderId.set(Number(r.legacy_id), Number(r.order_id));

  const purchaseLines = await q(`SELECT * FROM staging.invoice_details`);
  const polRows: unknown[][] = [];
  // Which supplier last supplied each item, used to fill in the item's supplier.
  const itemSupplier = new Map<number, number>();
  let returnedLines = 0;
  const poSupplier = new Map<number, number>(
    purchases.map((p: Row) => [num(p.InvoiceID), num(p.SupplierID)]),
  );
  for (const d of purchaseLines) {
    const order = orderId.get(num(d.InvoiceID));
    const item = itemId.get(num(d.ProductID));
    // Purchase lines require an inventory item; services are not stocked.
    if (!order || !item) continue;
    // A handful of lines carry a negative quantity: goods returned to the
    // supplier. The schema requires a positive order quantity, so they are
    // counted and reported rather than forced through as a purchase.
    const qty = num(d.Quantity);
    if (qty <= 0) {
      returnedLines++;
      continue;
    }
    polRows.push([
      num(d.InvoiceDetailID),
      order,
      item,
      qty,
      qty,
      Math.max(0, money(d.Price)) || null,
    ]);
    const sup = supplierId.get(poSupplier.get(num(d.InvoiceID)) ?? -1);
    if (sup) itemSupplier.set(item, sup);
  }
  await upsert(
    "purchase_order_lines",
    [
      "legacy_id",
      "order_id",
      "item_id",
      "quantity_ordered",
      "quantity_received",
      "unit_cost",
    ],
    polRows,
    [
      "order_id",
      "item_id",
      "quantity_ordered",
      "quantity_received",
      "unit_cost",
    ],
  );
  report.push(
    `purchase lines  ${polRows.length} (${returnedLines} supplier returns skipped)`,
  );

  // The product table never recorded a supplier (SupplierID is 0 on every row),
  // so an item's supplier is inferred from who the clinic actually bought it from.
  for (const [item, sup] of itemSupplier) {
    await prisma.$executeRawUnsafe(
      `UPDATE "inventory_items" SET "supplier_id" = $2 WHERE "item_id" = $1`,
      item,
      sup,
    );
  }
  report.push(
    `item suppliers  ${itemSupplier.size} items linked to a supplier`,
  );

  // Supplier payments. Without these the app shows the clinic owing the entire
  // purchase history, because every order imports as received and billed.
  const supPays = await q(`SELECT * FROM staging.suppayments`);
  const supPayRows: unknown[][] = [];
  for (const sp of supPays) {
    const sup = supplierId.get(num(sp.SupplierID));
    const amount = money(sp.PaymentAmount);
    if (!sup || amount <= 0 || !s(sp.PaymentDate)) continue;
    supPayRows.push([
      num(sp.PaymentID),
      sup,
      amount,
      s(sp.PaymentDate),
      s(sp.CheckNumber).slice(0, 100) || null,
    ]);
  }
  await upsert(
    "supplier_payments",
    ["legacy_id", "supplier_id", "amount", "paid_on", "reference"],
    supPayRows,
    ["supplier_id", "amount", "paid_on", "reference"],
  );
  report.push(`supplier pays   ${supPayRows.length}`);

  // ── Reconciliation ─────────────────────────────────────────────────────
  // The source stored prices as float32, so a handful of invoices do not sum
  // exactly once rounded to 2dp. The invoice total is taken from the source and
  // is authoritative; these few are flagged so the drift is visible rather than
  // quietly wrong on a printed invoice.
  const drift = await prisma.$executeRawUnsafe(`
    UPDATE "invoices" i SET "needs_review" = true, "review_note" =
      'Line items do not add up to the invoice total, by ' ||
      to_char(abs(i.total - s.ls), 'FM990.00') ||
      '. Caused by rounding in the old system. The total shown is the one it recorded.'
    FROM (SELECT li."invoice_id", SUM(li."line_total") ls
          FROM "invoice_line_items" li GROUP BY 1) s
    WHERE s."invoice_id" = i."invoice_id"
      AND i."legacy_id" IS NOT NULL
      AND abs(i.total - s.ls) > 0.005`);
  report.push(`reconciliation ${drift} invoices flagged for rounding drift`);

  const totals = await q<{ label: string; value: string }>(`
    SELECT 'source invoiced' label, to_char(SUM("AmountInv"::numeric),'FM999999990.00') value FROM staging.custinvoices
    UNION ALL SELECT 'imported total', to_char(SUM(total),'FM999999990.00') FROM "invoices" WHERE legacy_id IS NOT NULL`);
  console.log("\nreconciliation:");
  for (const t of totals) console.log(`  ${t.label.padEnd(16)} ${t.value}`);

  console.log("\nimported:");
  for (const line of report) console.log("  " + line);
}
