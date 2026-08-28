// Wipes the imported data so the migration can be re-run from scratch.
//
//   npx tsx src/lib/legacy-import/reset.ts --yes
//
// PRESERVED: services, users, roles, permissions, role_permissions.
// Everything else is clinic data that comes from the .mdb and is rebuilt by
// the loader, so it is safe to remove and expensive to keep half-migrated.
//
// Deletes in dependency order rather than using CASCADE, so a foreign key that
// is added later fails loudly here instead of silently dropping rows.

import { prisma } from "@/lib/prisma";

// Order matters: children before parents.
const WIPE_ORDER = [
  "reminders",
  "clinical_records",
  "notifications",
  "payments",
  "invoice_line_items",
  "invoices",
  "bookings",
  "inventory_transactions",
  "purchase_order_lines",
  "purchase_orders",
  "supplier_payments",
  // Both client and supplier opening balances. They come from the .mdb
  // (CustomerWholesale.BBack and Suppliers.BBack) and the transform rebuilds
  // them, so they are imported data like everything else here. Their two
  // foreign keys are RESTRICT rather than CASCADE, which is what made this
  // omission stop the reset dead instead of quietly leaving last import's
  // balances behind: the loader inserts ON CONFLICT DO NOTHING, so a stale row
  // would have survived every future import untouched.
  "opening_balances",
  "partner_payouts",
  "inventory_items",
  "partners",
  "suppliers",
  "patients",
  "clients",
] as const;

const PRESERVED = [
  "services",
  "users",
  "roles",
  "permissions",
  "role_permissions",
];

// Services are preserved, but the importer creates some of its own. Those carry
// a legacy_id and must be cleared too, otherwise a re-import leaves the old
// rows behind and stale classifications accumulate run after run.
//
// running_costs is here rather than in WIPE_ORDER for the same reason: the
// imported expense ledger must go, but a cost a staff member typed into the app
// (or one the app raised for itself from a hidden invoice line) has no
// legacy_id and is theirs, not the loader's.
const LEGACY_OWNED = ["services", "running_costs"] as const;

export async function reset() {
  const before = await counts();

  // opening_balances carries a BEFORE UPDATE OR DELETE trigger that refuses
  // both outright, because an opening balance is a statement of fact as at a
  // date and correcting one means adding a visible adjustment, never rewriting
  // history. That guard is aimed at the application, which must never quietly
  // restate a figure the clinic has already shown someone. A full reset is the
  // one operation entitled to remove them: it is discarding the whole imported
  // dataset, not editing a balance. So the trigger comes down for exactly the
  // length of that delete and goes straight back up.
  //
  // Both statements are DDL inside the transaction below, so a failure anywhere
  // in the wipe rolls the trigger back up with everything else. It cannot be
  // left disabled by a half-finished run.
  const drop = (t: string) => prisma.$executeRawUnsafe(`DELETE FROM "${t}"`);
  const guard = (action: "DISABLE" | "ENABLE") =>
    prisma.$executeRawUnsafe(
      `ALTER TABLE "opening_balances" ${action} TRIGGER "opening_balances_no_update"`,
    );

  // One transaction: either the database is fully cleared or untouched.
  await prisma.$transaction(
    WIPE_ORDER.flatMap((t) =>
      t === "opening_balances"
        ? [guard("DISABLE"), drop(t), guard("ENABLE")]
        : [drop(t)],
    ),
  );
  // Sequences restart so a re-import produces tidy ids rather than continuing
  // from wherever the previous attempt stopped.
  //
  // Columns come from pg_attribute keyed on the table's OID, NOT from
  // information_schema.columns filtered by table_schema. Six of the staging
  // tables share a name with a public one (payments, invoices, suppliers,
  // products among them), and a WHERE clause does not short-circuit: Postgres
  // is free to evaluate pg_get_serial_sequence() on a staging row before the
  // schema filter has excluded it, and that function raises rather than
  // returning NULL for a column the public table does not have. It fails on
  // "PaymentID", the staging spelling, which reads as nonsense until you know
  // the two tables collide. Resolving the OID once removes any chance of a
  // foreign schema's rows reaching the function at all, whatever plan the
  // planner picks.
  for (const t of WIPE_ORDER) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('public."${t}"', a.attname), 1, false)
       FROM pg_attribute a
       WHERE a.attrelid = 'public."${t}"'::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND pg_get_serial_sequence('public."${t}"', a.attname) IS NOT NULL`,
    );
  }

  for (const t of LEGACY_OWNED) {
    const removed = await prisma.$executeRawUnsafe(
      `DELETE FROM "${t}" WHERE "legacy_id" IS NOT NULL`,
    );
    if (removed > 0)
      console.log(`  ${t.padEnd(22)} removed ${removed} imported rows`);
  }

  const after = await counts();
  console.log("cleared:");
  for (const t of WIPE_ORDER) {
    if ((before[t] ?? 0) > 0)
      console.log(`  ${t.padEnd(22)} ${before[t]} -> ${after[t] ?? 0}`);
  }
  console.log("\npreserved:");
  for (const t of PRESERVED) console.log(`  ${t.padEnd(22)} ${after[t] ?? 0}`);
}

async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of [...WIPE_ORDER, ...PRESERVED]) {
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${t}"`,
    );
    out[t] = Number(r[0]?.n ?? 0);
  }
  return out;
}

if (process.argv[1]?.includes("reset")) {
  if (!process.argv.includes("--yes")) {
    console.error(
      "This deletes all imported clinic data. Re-run with --yes to confirm.",
    );
    process.exit(1);
  }
  reset().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
