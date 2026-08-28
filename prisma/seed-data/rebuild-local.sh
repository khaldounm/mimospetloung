#!/usr/bin/env bash
#
# Rebuilds the LOCAL database from scratch out of a GT_Data Access export.
#
#   ./prisma/seed-data/rebuild-local.sh ~/Desktop/GT_Data26_2026-08-17.mdb
#
# This is step 1 of the cutover runbook as a single command. It wipes the
# imported clinic data and rebuilds it in the one order that produces correct
# figures, because every step here depends on the one before it:
#
#   legacy:reset       clears imported data (KEEPS users, roles, permissions,
#                      and the clinic's own services)
#   legacy:import      the only source of invoices, payments, suppliers,
#                      purchase orders and opening balances. Also writes its own
#                      heuristic clients, pets and inventory.
#   refresh-from-mdb   regenerates the curated JSON from the same .mdb
#   seed:clients       overwrites the heuristic clients and pets
#   seed:inventory     overwrites the heuristic inventory AND rewrites
#                      current_stock from the curated counts
#   seed:ledger        builds the stock ledger. Must come after seed:inventory:
#                      it sizes each item's opening position against
#                      current_stock, so running it earlier silently stops
#                      footing the moment the curated seed lands.
#   review:export      the human worklist
#
# Reversed or partial, the failure is quiet rather than loud: client names
# revert to the first-token split, or COGS reports a near-100% margin, and
# nothing errors. That is why this is a script and not a list to follow by hand.
#
# LOCAL ONLY. It refuses to run against a remote database: this wipes tables,
# and prod is loaded by db:restore, never by re-running the loader.
set -euo pipefail

MDB=${1:-}
if [ -z "$MDB" ] || [ ! -f "$MDB" ]; then
  echo "usage: $0 <path to GT_Data.mdb>" >&2
  echo "" >&2
  echo "Take the export on the day for a real cutover. Anything staff typed" >&2
  echo "into Access after it is lost: the switch is one-way." >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
cd "$ROOT"

# The loader wipes tables, so pointing it at Supabase would destroy the review
# database (or worse, prod after cutover). .env holds both connection pairs and
# they are swapped by commenting lines, which is exactly the kind of thing that
# gets left half-done.
DB_HOST=$(grep -m1 '^DATABASE_URL=' .env | sed -E 's#.*://[^@]*@([^:/]+).*#\1#')
case "$DB_HOST" in
  localhost | 127.0.0.1) ;;
  *)
    echo "DATABASE_URL points at '$DB_HOST', not localhost." >&2
    echo "This rebuild wipes and reloads. Point .env at localhost first." >&2
    exit 1
    ;;
esac

echo "rebuilding from $(basename "$MDB")"
echo "  exported $(date -r "$MDB" '+%Y-%m-%d %H:%M')"
echo ""

step() { echo ""; echo "── $1 ─────────────────────────────────────────"; }

step "1/7  clearing imported data"
pnpm legacy:reset -- --yes

step "2/7  importing the Access export"
pnpm legacy:import -- --mdb "$MDB"

step "3/7  regenerating curated seed data"
"$DIR/refresh-from-mdb.sh" "$MDB"

step "4/7  seeding curated clients and pets"
pnpm seed:clients

step "5/7  seeding curated inventory and services"
pnpm seed:inventory

step "6/7  building the stock ledger"
pnpm seed:ledger

step "7/7  writing the review worklist"
pnpm review:export

echo ""
echo "done. Check the ledger footed on every item above before trusting the"
echo "profit figures, then open /analytics and confirm cost of goods sold is"
echo "no longer near zero."
