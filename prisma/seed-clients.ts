/**
 * Seeds the curated client and patient records from the legacy Access system.
 *
 * The rows in seed-data/ are already resolved: names split, salutations lifted
 * into their own column, breeds separated from pet names, duplicates flagged.
 * Nothing is inferred at run time, so a seed always produces the same database.
 * The decisions and the reasoning behind them live in seed-data/curate.py,
 * which regenerates the JSON from a GT_Data .mdb export.
 *
 *   pnpm seed:clients            upsert clients and patients
 *   pnpm seed:clients -- --check report what would change, write nothing
 *
 * Runs after legacy:import, or on its own: both key on legacyId, so the two
 * can be re-run in any order without duplicating rows.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  LEGACY_OPENING_BALANCE_DATE as OPENING_BALANCE_DATE,
  LEGACY_OPENING_BALANCE_SOURCE_CLIENT as OPENING_BALANCE_SOURCE,
} from "@/constants/legacy-import";

type SeedClient = {
  legacyId: number;
  salutation: string | null;
  firstName: string;
  lastName: string;
  accountBalance: number;
  // What the client owed before this file's own history begins, when the old
  // system's arithmetic proves it is still outstanding. Null when there was
  // none, or when the figure could not be trusted; see curate.py.
  openingBalance: number | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  notes: string | null;
  needsReview: boolean;
  reviewNote: string | null;
};

type SeedPatient = {
  legacyId: number;
  clientLegacyId: number;
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  notes: string | null;
  needsReview: boolean;
  reviewNote: string | null;
};

const DATA_DIR = join(import.meta.dirname, "seed-data");

function load<T>(file: string): T[] {
  return JSON.parse(readFileSync(join(DATA_DIR, file), "utf8")) as T[];
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const clients = load<SeedClient>("clients.json");
  const patients = load<SeedPatient>("patients.json");

  console.log(
    `${clients.length} clients and ${patients.length} patients to seed` +
      (checkOnly ? " (check only, nothing will be written)" : ""),
  );

  if (checkOnly) {
    const existing = await prisma.client.count({
      where: { legacyId: { not: null } },
    });
    const flagged = clients.filter((c) => c.needsReview).length;
    const petsFlagged = patients.filter((p) => p.needsReview).length;
    console.log(`  already imported: ${existing} clients`);
    console.log(
      `  flagged for review: ${flagged} clients, ${petsFlagged} pets`,
    );
    return;
  }

  // Upsert on legacyId so re-running is the cutover delta rather than a
  // duplicate import.
  //
  // One multi-row INSERT ... ON CONFLICT per chunk rather than a transaction of
  // per-row upserts. Prisma's upsert costs a round trip each, which is fine on
  // localhost and far too slow against Supabase: 200 rows took over the 5s
  // interactive-transaction limit on latency alone. This is one round trip per
  // chunk, so the remote run is a handful of statements instead of ~3,300.
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < clients.length; i += CHUNK) {
    const batch = clients.slice(i, i + CHUNK);
    const values = batch.map(
      (c) => Prisma.sql`(
        ${c.legacyId}::int, ${c.salutation}::varchar, ${c.firstName}::varchar,
        ${c.lastName}::varchar, ${c.accountBalance.toFixed(2)}::numeric,
        ${c.phone}::varchar, ${c.phone2}::varchar, ${c.email}::citext,
        ${c.notes}::text, ${c.needsReview}::boolean, ${c.reviewNote}::text,
        now(), now())`,
    );
    // deletedAt is deliberately absent from the update list: if staff archived
    // a client after an earlier import, re-seeding must not resurrect them.
    await prisma.$executeRaw`
      INSERT INTO clients (
        legacy_id, salutation, first_name, last_name, account_balance,
        phone, phone2, email, notes, needs_review, review_note,
        created_at, updated_at)
      VALUES ${Prisma.join(values)}
      ON CONFLICT (legacy_id) DO UPDATE SET
        salutation      = EXCLUDED.salutation,
        first_name      = EXCLUDED.first_name,
        last_name       = EXCLUDED.last_name,
        account_balance = EXCLUDED.account_balance,
        phone           = EXCLUDED.phone,
        phone2          = EXCLUDED.phone2,
        email           = EXCLUDED.email,
        notes           = EXCLUDED.notes,
        needs_review    = EXCLUDED.needs_review,
        review_note     = EXCLUDED.review_note,
        updated_at      = now()`;
    written += batch.length;
    process.stdout.write(`\r  clients ${written}/${clients.length}`);
  }
  console.log("");

  const clientIdByLegacy = new Map<number, number>(
    (
      await prisma.client.findMany({
        where: { legacyId: { not: null } },
        select: { clientId: true, legacyId: true },
      })
    ).map((c) => [c.legacyId as number, c.clientId]),
  );

  // Opening balances. Written as immutable dated rows rather than folded into
  // account_balance, which ALREADY contains them: the old system's WSAccount is
  // BBack + invoiced - paid, so adding them again would bill the client twice.
  // They exist so a statement shows where the figure started.
  const opening = clients.filter((c) => c.openingBalance !== null);
  if (opening.length) {
    const values = opening.map(
      (c) => Prisma.sql`(
        ${clientIdByLegacy.get(c.legacyId) ?? null}::int,
        ${c.openingBalance!.toFixed(2)}::numeric,
        ${OPENING_BALANCE_DATE}::date,
        ${OPENING_BALANCE_SOURCE}::varchar,
        ${String(c.legacyId)}::varchar)`,
    );
    // DO NOTHING because the row is immutable: a re-run must never restate a
    // figure the clinic has already put in front of someone.
    await prisma.$executeRaw`
      INSERT INTO opening_balances
        (client_id, amount, as_of_date, source, source_ref)
      SELECT * FROM (VALUES ${Prisma.join(values)}) AS v
      WHERE v.column1 IS NOT NULL
      ON CONFLICT (client_id, as_of_date) DO NOTHING`;
    console.log(`  opening balances ${opening.length}`);
  }

  let petsWritten = 0;
  let orphaned = 0;
  for (let i = 0; i < patients.length; i += CHUNK) {
    const batch = patients.slice(i, i + CHUNK);
    const resolved = batch.flatMap((p) => {
      const clientId = clientIdByLegacy.get(p.clientLegacyId);
      if (clientId === undefined) {
        orphaned += 1;
        return [];
      }
      const { clientLegacyId, ...rest } = p;
      void clientLegacyId;
      return [{ ...rest, clientId }];
    });
    if (resolved.length > 0) {
      const values = resolved.map(
        (p) => Prisma.sql`(
          ${p.legacyId}::int, ${p.clientId}::int, ${p.name}::varchar,
          ${p.species}::varchar, ${p.breed}::varchar, ${p.sex}::varchar,
          ${p.notes}::text, ${p.needsReview}::boolean, ${p.reviewNote}::text,
          now(), now())`,
      );
      await prisma.$executeRaw`
        INSERT INTO patients (
          legacy_id, client_id, name, species, breed, sex, notes,
          needs_review, review_note, created_at, updated_at)
        VALUES ${Prisma.join(values)}
        ON CONFLICT (legacy_id) DO UPDATE SET
          client_id    = EXCLUDED.client_id,
          name         = EXCLUDED.name,
          species      = EXCLUDED.species,
          breed        = EXCLUDED.breed,
          sex          = EXCLUDED.sex,
          notes        = EXCLUDED.notes,
          needs_review = EXCLUDED.needs_review,
          review_note  = EXCLUDED.review_note,
          updated_at   = now()`;
    }
    petsWritten += resolved.length;
    process.stdout.write(`\r  patients ${petsWritten}/${patients.length}`);
  }
  console.log("");

  if (orphaned > 0) {
    console.warn(
      `  ${orphaned} patients had no matching client and were skipped`,
    );
  }

  // Reconcile. An earlier import invented pets that this curation does not
  // produce -- splitting a "<breed> - <name>" entry into two animals, for
  // instance. Upserting alone leaves those behind, so remove the ones nothing
  // references and flag the rest instead of deleting history.
  const seededPetIds = new Set(patients.map((p) => p.legacyId));
  const strays = await prisma.patient.findMany({
    where: { legacyId: { not: null }, deletedAt: null },
    select: {
      patientId: true,
      legacyId: true,
      name: true,
      _count: {
        select: { clinicalRecords: true, bookings: true, reminders: true },
      },
    },
  });

  const removable: number[] = [];
  const keepFlagged: number[] = [];
  for (const p of strays) {
    if (seededPetIds.has(p.legacyId as number)) continue;
    const referenced =
      p._count.clinicalRecords + p._count.bookings + p._count.reminders > 0;
    (referenced ? keepFlagged : removable).push(p.patientId);
  }

  if (removable.length > 0) {
    await prisma.patient.deleteMany({
      where: { patientId: { in: removable } },
    });
    console.log(
      `  removed ${removable.length} pets a previous import invented`,
    );
  }
  if (keepFlagged.length > 0) {
    await prisma.patient.updateMany({
      where: { patientId: { in: keepFlagged } },
      data: {
        needsReview: true,
        reviewNote:
          "A previous import created this pet and the corrected data no longer " +
          "lists it, but it already has visits or bookings. Check whether it is " +
          "a real animal before removing it.",
      },
    });
    console.log(
      `  flagged ${keepFlagged.length} leftover pets that already have history`,
    );
  }

  const flagged = await prisma.client.count({ where: { needsReview: true } });
  const petsFlagged = await prisma.patient.count({
    where: { needsReview: true },
  });
  console.log(
    `Done. ${flagged} clients and ${petsFlagged} pets are flagged for review.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
