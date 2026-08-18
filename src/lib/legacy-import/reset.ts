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
const LEGACY_OWNED = ["services"] as const;

export async function reset() {
  const before = await counts();

  // One transaction: either the database is fully cleared or untouched.
  await prisma.$transaction(
    WIPE_ORDER.map((t) => prisma.$executeRawUnsafe(`DELETE FROM "${t}"`)),
  );
  // Sequences restart so a re-import produces tidy ids rather than continuing
  // from wherever the previous attempt stopped.
  for (const t of WIPE_ORDER) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t}"', c.column_name), 1, false)
       FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = '${t}'
         AND pg_get_serial_sequence('"${t}"', c.column_name) IS NOT NULL`,
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
