"""Curate the GT_Data26 Products table into inventory items and services.

The old transform guessed categories from product names with a three-pass
keyword list. It did not need to: the .mdb carries a `Category` table and every
product points at it, so the clinic's own classification is used instead. That
alone fixes the cat foods filed under Diagnostics and the dental chews filed
under Surgery.
"""
import csv, json, re, collections

SRC, OUT = "prod.csv", "out/"

# ---------------------------------------------------------------- categories
# The clinic's own list, from the Category table, with its typos corrected and
# names made meaningful where the original was an internal shorthand.
CATEGORY = {
    1: "Food", 2: "Accessories", 3: "Toys", 4: "Treats",
    5: "Medication", 6: "Grooming Supplies", 7: "Consumables",
    9: "Work Supplies", 10: "Expenses", 11: "Supplements",
    13: "Grooming Supplies", 14: "Dental", 15: "Surgery", 16: "Diagnostics",
}
# Categories whose rows are billable work rather than stock. 13 "Grooming" is
# deliberately absent: every row in it is a bulk shampoo or conditioner, i.e.
# a grooming supply. Category 5 is mixed and split by StockProd below.
SERVICE_CATS = {6, 14, 15, 16}
# Category 5 covers both stocked drugs and the vet's own work. As stock it is
# "Medication"; as a service it is a consultation or procedure.
SERVICE_CATEGORY = {**CATEGORY, 5: "Veterinary", 6: "Grooming"}

# A volume in the name means the row is a product even inside a service
# category ("dermevet bulk shampoo 5L"). Volume, not weight: the kg in
# "detatrage dog 10-20kg" is the animal's weight, not a pack size.
#
# Note the pack size is deliberately NOT lifted into the  column. That
# column is the unit of measure the stock is counted in ("box", "vial", "kg"),
# so putting "25L" there made the stock column read "47 25L" for what is really
# 47 bags of 25 litres. The pack size already sits in the product name, which
# is the only place it belongs.
VOLUME = re.compile(r"\b\d+(?:[.,]\d+)?\s*(?:ml|cl|l|lt|liter|litre)\b", re.I)

# Misspellings in clinic-facing names. These appear on invoices, so they are
# corrected rather than flagged; the original is kept in the description.
SPELLING = [
    (re.compile(r"\bdetatrage\b", re.I), "detartage"),
    (re.compile(r"\bcatration\b", re.I), "castration"),
    (re.compile(r"\bcastraion\b", re.I), "castration"),
    (re.compile(r"\beuthansia\b", re.I), "euthanasia"),
    (re.compile(r"\bvisite\b", re.I), "visit"),
    (re.compile(r"\bbourding\b", re.I), "boarding"),
    (re.compile(r"\btreatmnet\b", re.I), "treatment"),
    (re.compile(r"\bbionte\b", re.I), "bionote"),
    (re.compile(r"\binjecion\b", re.I), "injection"),
    (re.compile(r"\bsimperica\b", re.I), "simparica"),
]

def norm(s): return re.sub(r"\s+", " ", (s or "").strip())

def fix_spelling(name):
    out = name
    for pat, rep in SPELLING:
        out = pat.sub(rep, out)
    return out

# ---------------------------------------------------------------- barcodes
# Three imports shipped with no barcodes because this comment used to say there
# were none. That was wrong. Products.BarCode, ProdCodeNo and ProdCodeTxt ARE
# empty on all 3,692 rows, and the BarCode on invoice lines is a stale internal
# sequence number (846 of its values are not even valid ProductIDs). But the
# real codes live in a one-to-many side table, BarcodeData, which is what the
# Barcode subform on the Products screen is bound to. 3,625 codes, 3,430
# products, no duplicates, no orphans.
#
# Stored zero-padded to GTIN-14, NOT as scanned. A UPC-A written "087219130735"
# and the same product read off a carton as "00087219130735" are the same
# article, and only the padded form matches both. Normalise every scan to 14
# before looking it up. Verified: 3,170 codes, zero collisions either way.
#
# Kept: numeric, 12 to 14 digits (UPC-A, EAN-13, ITF-14).
# Dropped: 243 staff shelf codes ("d1", "pb2", "LE-DOG-20210125"). They are not
# scannable and would only pollute a unique column. The old Products form has
# its own BarCode lookup box, so if staff type these to find items it will
# surface fast, and re-including them is a one-line change here.
#
# One code per item, the lowest Bid, i.e. the first one scanned. 77 items carry
# more than one; the extras are genuine variants and are flagged for review
# rather than silently dropped. The end state for those is a product_barcodes
# table carrying pack size, because the 14-digit ITF-14s are CASE codes and one
# column cannot say "this code means 12 units". That is additive and this seed
# regenerates from the .mdb, so nothing is lost by deferring it.
BARCODES = "bcodes.csv"

def gtin14(code):
    """Canonical GTIN-14. Returns None for anything not scannable."""
    c = (code or "").strip()
    return c.zfill(14) if c.isdigit() and 12 <= len(c) <= 14 else None

barcodes, shelf_codes = {}, collections.defaultdict(list)
try:
    _bc = list(csv.DictReader(open(BARCODES)))
except FileNotFoundError:
    _bc = []
    print("  WARNING: bcodes.csv missing, importing without barcodes")
for _r in sorted(_bc, key=lambda r: int(r["Bid"] or 0)):
    _pid, _raw = (_r.get("Prodid") or "").strip(), (_r.get("BarcodeText") or "").strip()
    if not _pid or not _raw:
        continue
    _g = gtin14(_raw)
    if _g is None:
        shelf_codes[_pid].append(_raw)
    else:
        barcodes.setdefault(_pid, []).append(_g)

# ---------------------------------------------------------------- load
rows = list(csv.DictReader(open(SRC)))
def g(r, k): return (r[k] or "").strip()
def num(r, k):
    try: return float(g(r, k) or 0)
    except ValueError: return 0.0

sold = {(r.get("ProductID") or "").strip() for r in csv.DictReader(open("sales.csv"))}
bought = {(r.get("ProductID") or "").strip() for r in csv.DictReader(open("purch.csv"))}
traded = sold | bought

items, services, skipped = [], [], []
stats = collections.Counter()

for r in rows:
    pid = g(r, "ProductID")
    raw_name = norm(g(r, "ProductName"))
    cid = int(g(r, "CategoryID") or 0)
    stock = num(r, "stock")
    sale = num(r, "UnitPrice")
    cost = num(r, "InitialPrice")
    stocked = g(r, "StockProd") == "Yes"
    reviews = []

    if not raw_name or raw_name == "0":
        skipped.append({"legacyId": int(pid), "reason": "no product name"})
        stats["skipped_no_name"] += 1
        continue

    name = fix_spelling(raw_name)
    renamed = name != raw_name
    if renamed: stats["spelling_fixed"] += 1

    is_service = (cid in SERVICE_CATS or (cid == 5 and not stocked)) \
        and not VOLUME.search(name)
    if (cid in SERVICE_CATS or cid == 5) and VOLUME.search(name) and not stocked:
        stats["supply_in_service_category"] += 1

    if len(name) < 3:
        reviews.append(f'The old system recorded this only as "{raw_name}".')
        stats["name_too_short"] += 1

    if is_service:
        # Stock on a service is meaningless: every sale decrements a quantity
        # that was never received, which is why "visit" sits at -581.
        services.append({
            "legacyId": int(pid),
            "name": name[:255],
            "category": SERVICE_CATEGORY.get(cid),
            "price": round(sale, 2),
            "isActive": pid in traded or sale > 0,
            "description": f'Recorded in the old system as "{raw_name}".'
                           if renamed else None,
            "needsReview": bool(reviews) or sale <= 0,
            "reviewNote": " ".join(
                reviews + ([] if sale > 0 else
                           ["No price was set in the old system."])) or None,
        })
        stats["services"] += 1
        continue

    # Products: keep anything the clinic trades, still holds, or has priced.
    #
    # An earlier version dropped everything untraded with no stock, which threw
    # away 1,830 priced products. That was wrong for the same reason it would be
    # wrong for clients: this file covers 2026 only, so a line that sold through
    # 2025 and is currently out of stock looks identical to catalogue padding.
    # A price means the clinic decided what to charge for it, which is a much
    # better signal of a real product than a sale in one particular year.
    if pid not in traded and stock == 0 and sale <= 0:
        skipped.append({"legacyId": int(pid), "name": raw_name,
                        "reason": "never traded and no stock"})
        stats["skipped_catalogue"] += 1
        continue

    if stock < 0:
        reviews.append(
            f"The old system had stock at {stock:g}, which cannot be right for "
            f"a stocked item. Set to 0; count it and correct.")
        stats["negative_stock"] += 1
        stock = 0
    if sale <= 0:
        reviews.append("No sale price was set in the old system.")
        stats["no_sale_price"] += 1

    codes = barcodes.get(pid, [])
    if len(codes) > 1:
        reviews.append(
            f"The old system held {len(codes)} barcodes for this item; "
            f"{codes[0]} was imported and {', '.join(codes[1:])} were not.")
        stats["multi_barcode"] += 1
    elif not codes and pid in shelf_codes:
        reviews.append(
            f"The old system had no scannable barcode for this item, only the "
            f"shelf code {', '.join(shelf_codes[pid])}. Scan it in.")
        stats["shelf_code_only"] += 1

    items.append({
        "legacyId": int(pid),
        "name": name[:255],
        "category": CATEGORY.get(cid),
        "unit": None,
        "currentStock": round(stock, 2),
        "reorderLevel": 0,
        "salePrice": round(sale, 2) if sale > 0 else None,
        "lastCost": round(cost, 2) if cost > 0 else None,
        "barcode": codes[0] if codes else None,
        "notes": f'Recorded in the old system as "{raw_name}".'
                 if renamed else None,
        "needsReview": bool(reviews),
        "reviewNote": " ".join(reviews) or None,
    })
    stats["items"] += 1
    if codes: stats["with_barcode"] += 1
    if pid not in traded: stats["items_untraded_but_stocked"] += 1

json.dump(items, open(OUT + "inventory.json", "w"), indent=1, ensure_ascii=False)
json.dump(services, open(OUT + "services.json", "w"), indent=1, ensure_ascii=False)
json.dump(skipped, open(OUT + "skipped-products.json", "w"), indent=1, ensure_ascii=False)

print("=== inventory curation ===")
for k, v in sorted(stats.items()): print(f"  {k:<28} {v}")
print(f"\n  categories used: "
      f"{sorted({i['category'] for i in items if i['category']})}")
print(f"  service categories: "
      f"{sorted({s['category'] for s in services if s['category']})}")
