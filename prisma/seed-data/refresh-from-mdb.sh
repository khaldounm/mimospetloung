#!/usr/bin/env bash
#
# Rebuilds the curated seed data from a GT_Data Access export.
#
#   ./prisma/seed-data/refresh-from-mdb.sh ~/Desktop/GT_Data26_2026-08-17.mdb
#
# Exports the five tables the curation reads, runs both curation scripts, and
# leaves the JSON in prisma/seed-data/ ready for `pnpm seed:clients` and
# `pnpm seed:inventory`.
#
# Needs mdbtools:  brew install mdbtools
#
# The .mdb and the client/pet JSON it produces are real client PII and are
# gitignored. Do not move them out of this machine.
set -euo pipefail

MDB=${1:-}
if [ -z "$MDB" ] || [ ! -f "$MDB" ]; then
  echo "usage: $0 <path to GT_Data.mdb>" >&2
  exit 1
fi
command -v mdb-export >/dev/null || {
  echo "mdb-export not found. Install it with: brew install mdbtools" >&2
  exit 1
}

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$DIR/.work"
mkdir -p "$WORK/out"

# Table -> file. "Invoice Details" has a space in its name and is PURCHASES,
# while CustInvoiceDetails is sales; mixing them up silently inverts the
# traded-product set, so both are named explicitly here.
#
# BarcodeData is a one-to-many side table (the Barcode subform on the Products
# screen), NOT Products.BarCode, which is empty on every row. Leaving it out of
# this list is why the first three imports shipped with no barcodes at all.
export_table() {
  local table="$1" out="$2"
  echo "  $table -> $out"
  mdb-export "$MDB" "$table" > "$WORK/$out"
  # A missing table exports as an empty file rather than failing, which would
  # quietly produce a curation with no sales history.
  if [ "$(wc -l < "$WORK/$out")" -lt 2 ]; then
    echo "    WARNING: $table produced no rows. Check the table name." >&2
  fi
}

echo "Exporting from $(basename "$MDB")"
export_table CustomerWholesale   cust.csv    # clients, with pets in Notes
export_table CustInvoices        inv.csv     # sales invoices (who transacted)
export_table Products            prod.csv    # products and services
export_table CustInvoiceDetails  sales.csv   # sales lines
export_table "Invoice Details"   purch.csv   # PURCHASE lines, not sales
export_table BarcodeData         bcodes.csv  # the real barcodes, see below
export_table Payments            pay.csv     # client payments, for opening balances

echo "Curating"
( cd "$WORK" && python3 "$DIR/curate.py" && python3 "$DIR/curate-inventory.py" )

for f in clients patients inventory services; do
  cp "$WORK/out/$f.json" "$DIR/$f.json"
done
cp "$WORK/out/skipped-products.json" "$DIR/skipped-products.json" 2>/dev/null || true
cp "$WORK/out/dropped.json" "$DIR/dropped-clients.json" 2>/dev/null || true

echo
echo "Written to prisma/seed-data/:"
for f in clients patients inventory services; do
  printf "  %-16s %s rows\n" "$f.json" \
    "$(python3 -c "import json,sys;print(len(json.load(open('$DIR/$f.json'))))")"
done
echo
echo "Next:  pnpm seed:clients && pnpm seed:inventory && pnpm review:export"
