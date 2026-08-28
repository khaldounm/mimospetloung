# Cutover runbook

What to do on the day the clinic hands over the final `GT_Data` export and the
new system goes live.

This is a **one-way switch**, not a repeating sync:

- The old Access system becomes read-only. Nobody types into it again.
- The new system goes online, and staff review the imported records.
- While review is happening, nothing new goes into the app. Day-to-day work is
  written on paper.
- Once review is finished, the system takes off and the paper backlog is
  entered by hand.

Because the import runs exactly once, before review starts, none of the review
decisions can be overwritten by a later import. There is no second run.

**Until that day, the Supabase database is a review environment, not
production.** The clinic uses it to check whether the import got things right.
Nothing in it is precious, nobody's day-to-day work lives there, and re-seeding
it is cheap. That is a different job from cutover and it has its own, much
shorter procedure: see [Shipping a change for the client to
check](#shipping-a-change-for-the-client-to-check) below. Everything from "The
sequence" onward describes the one-way switch itself.

---

## Shipping a change for the client to check

Use this while the remote is still a review environment. It is **not** the
cutover sequence and it does not need a dump or a restore.

```bash
# .env -> Supabase
pnpm db:deploy
pnpm seed:clients      # and/or pnpm seed:inventory, whichever changed
# .env -> localhost
git push
```

- `db:deploy` applies any pending migration. `db:restore` is not needed: that
  one drops and reloads the whole schema, which is cutover's job, not this.
- The seeds upsert on `legacyId`, so re-running them is safe and repeatable.
- **Migrate before you push, never after.** Vercel builds with
  `prisma generate && next build`, so the moment the new code deploys it
  expects the new tables. Push first and every page touching them returns 500
  until the migration lands. The reverse order is harmless: the running code
  simply ignores a table it does not know about.
- Flip `.env` back the moment you are done. Every script in this repo acts on
  whatever it says, and that is the single biggest foot-gun here.

**What this path cannot ship: anything the loader owns.** Suppliers, invoices,
payments, purchase orders, supplier payments and supplier opening balances are
written by `pnpm legacy:import`, not by the curated seeds. There is no
standalone seed for them. Running `legacy:import` against the remote drags the
whole ordering problem with it (it rewrites clients and pets with its heuristic
versions, so both curated seeds have to run again afterwards), at which point
you have re-run the full sequence over the network. Doing it locally and
shipping a dump is faster and less fragile.

So: **client, pet, inventory and service changes go through the light path.
Anything touching suppliers or invoices means the full sequence.**

---

## Before the day

| Task                                                      | Why                                                                                                                                                                                                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirm `mdbtools` is installed (`brew install mdbtools`) | The refresh script shells out to `mdb-export`.                                                                                                                                                                                                                   |
| Get the `.mdb` export **on the day**, not in advance      | Staff are still scanning barcodes and adding products into Access. Between 2026-08-17 and 2026-08-20 alone, 7 products were added. Anything they typed after your export is simply lost, and it is a one-way switch, so there is no second import to pick it up. |
| Confirm the nightly backup workflow is green              | It is the only way back if the restore goes wrong.                                                                                                                                                                                                               |
| Decide who answers the review worklist                    | The CSV is useless without someone who knows the clients.                                                                                                                                                                                                        |
| Re-run the five local steps below once, as a rehearsal    | Proves the scripts work on your machine before the day you are under time pressure. Rehearse them in order, `legacy:import` first.                                                                                                                               |

**Known open question:** invoice ids and client ids are proven not to collide
across year files, but `Products` and `Suppliers` are **unverified**. If the
clinic hands over more than one `GT_Data<YY>.mdb`, that needs checking before
seeding. With a single file this does not apply.

---

## The sequence

Every command acts on whatever `.env` points at. That is the single biggest
risk in this whole procedure, so the target is written above each block.

### 1. Seed and check, against LOCAL

Point `.env` at localhost (uncomment the two `localhost` lines, comment the two
Supabase ones).

```bash
pnpm legacy:import -- --mdb ~/Desktop/GT_Data<new>.mdb
./prisma/seed-data/refresh-from-mdb.sh ~/Desktop/GT_Data<new>.mdb
pnpm seed:clients
pnpm seed:inventory
pnpm seed:ledger
pnpm review:export
```

**The order is load-bearing and the same `.mdb` goes to both.** `legacy:import`
is the only thing that brings across invoices, payments, suppliers, purchase
orders, supplier payments and supplier opening balances. It also writes its own
heuristic clients, pets and inventory, which the two curated seeds then
overwrite with the better versions. Run it second and it undoes them: client
names revert to the first-token split and invented pets come back.

Leaving `legacy:import` out is the quieter failure. Everything still looks
right, because the loader-owned tables keep whatever the last run left behind,
so the clinic goes live on stale invoices and balances from an older export
while the client list looks perfectly current.

- `legacy:import` extracts the .mdb into a staging schema and transforms it. It
  upserts on `legacyId`, so re-running it is safe and is how the delta lands.
- `refresh-from-mdb.sh` exports the seven tables the curation reads, runs both
  curation scripts, and writes the JSON into `prisma/seed-data/`. It reports a
  row count per file at the end.
- `seed:clients` and `seed:inventory` upsert on `legacyId` and reconcile: rows a
  previous import invented are removed when nothing references them, and flagged
  when they already have history.
- `seed:ledger` turns the imported invoices and purchase orders into the stock
  movements they imply, so cost of goods sold and profit are readable at all.
  Without it the analytics report an imported year of trading at a near-100%
  margin, because COGS is derived from `Sold` movements and there are none.
  **It has to run after `seed:inventory`**, which rewrites `current_stock` from
  the curated JSON: each item gets one `Opening` movement sized so the ledger
  foots to that count, and a ledger built before the seed lands would be sized
  against the loader's own heuristic stock instead. It never changes
  `current_stock` itself. `pnpm seed:ledger -- --check` reports what it would
  write without writing it.
- `review:export` writes `prisma/seed-data/review-worklist.csv`, the list of
  everything a human needs to confirm, ordered so the decisions that affect
  money come first.

**Check the numbers before going further.** If clients or inventory jumped by
an order of magnitude, or a pile of unfamiliar categories appeared, stop and
find out why. The scripts will happily import nonsense.

As of the 2026-08-17 file the expected shape is roughly 1,875 clients, 1,397
pets, 3,564 inventory items and 49 services, with `with_barcode` around 3,170,
`opening_balance_imported` 27 and `opening_balance_flagged` 13.
Those will all drift up a little, because staff are still entering data into
Access. A `with_barcode` count that drops sharply is the one to be suspicious
of: it means the `BarcodeData` export failed and the script would otherwise
import silently without barcodes, which is exactly how the first three imports
shipped with none.

**Opening balances are written once and cannot be edited.** `opening_balances`
rows are immutable at the database level: a trigger rejects UPDATE and DELETE,
because the figure is evidence of what a party owed on 1 January 2026 and the
Access file behind it is about to become read-only. Re-running a seed does
nothing to a row that already exists. If a figure turns out to be wrong, it is
corrected by a later visible adjustment, never by rewriting it. Get step 1's
counts right before seeding, because this is the one part of the import that
does not forgive a re-run.

**Archive the .mdb with a checksum.** Every opening balance cites it as its
source, and once Access is read-only that file is the only supporting document
behind the figures. Store it somewhere durable with `shasum -a 256` recorded,
not on a desktop.

### 2. Back up production

Run the **Database backup** workflow in the GitHub Actions tab and wait for
green.

This is not the same as `pnpm db:backup`. That one dumps your local database.
This one protects production before the next step drops its schema.

### 3. Dump local, still against LOCAL

```bash
pnpm db:backup
```

Writes a dump into `dumps/` (gitignored: it is real client data).

### 4. Restore into PRODUCTION

Now switch `.env` to Supabase. Use the **direct** URL on port **5432**, not the
6543 pooler: `pg_restore` needs session state the pooler cannot hold.

```bash
pnpm db:restore -- --yes
```

Without `--yes` it refuses and tells you what it is about to do.

**What this does:** `DROP SCHEMA public CASCADE`, then reload from the newest
dump in `dumps/`. It copies `users`, `roles`, `permissions`, `role_permissions`
and `audit_log` off production first and puts them back afterwards, so logins
and the audit trail survive. Everything else on production is replaced by your
local copy, which on cutover day is the point: production has nothing worth
keeping yet.

### 5. Switch `.env` back to LOCAL

Do this immediately. Otherwise the next `pnpm dev` runs the app against
production.

### 6. Verify production

With `.env` briefly on Supabase:

```bash
pnpm seed:clients -- --check
```

It writes nothing and reports how many clients are already imported. Match it
against what step 1 printed. Then switch back to local.

---

## Why the ordering matters

`db:backup` and `db:restore` both read `.env`. The dump has to be taken while
`.env` is local, and the restore has to run while `.env` is production. Two
switches, one on each side of the restore.

Getting it backwards either dumps production over your good local data, or
loads a stale dump into production. Neither is recoverable without the backup
from step 2, which is why step 2 is not optional.

---

## After cutover

The review worklist is the remaining work, and it is people work, not code:

- **Possible duplicates** are the only category with money attached. Two records
  for one client means their balance is split across both.
- **Unnamed pets** are the largest group and should not be done in one sitting.
  They resolve at the front desk as animals come in and staff see the review
  badge.
- The clients and patients pages have a **Needs review** filter so staff can work
  the queue in the app rather than from the CSV.

---

## When to get help rather than run the scripts

Three cases, and only these:

1. **The file's shape changed.** A renamed table, a new column, a category id
   that has never appeared. The curation either crashes, which is fine and
   loud, or silently mis-files things, which is not. The one known soft
   failure is `BarcodeData`: if that table is missing the script warns and
   carries on without barcodes rather than stopping.
2. **More than one year file.** See the open question above about `Products`
   and `Suppliers` ids.
3. **The counts look wrong** after step 1.

Everything else is the four commands in step 1 plus the backup and restore.
