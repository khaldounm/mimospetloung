-- Additional barcodes per item, carrying a pack size.
--
-- The primary code stays on inventory_items.barcode and is untouched: it is
-- what the label printer prints and what the item form edits. This table is for
-- the codes that column cannot express, and the important one is the CASE code.
--
-- A carton of twelve carries its own ITF-14, distinct from the unit EAN-13. A
-- single barcode column cannot say "this code means twelve", so scanning the
-- outer carton at goods receipt books one unit. The 22 ITF-14s imported from
-- the old system are exactly these.
CREATE TABLE "inventory_barcodes" (
  "barcode_id" SERIAL PRIMARY KEY,
  "item_id"    INTEGER NOT NULL REFERENCES "inventory_items"("item_id") ON DELETE CASCADE,
  -- GTIN-14 so every zero-padded representation of one code compares equal.
  "gtin"       VARCHAR(20) NOT NULL UNIQUE,
  "pack_size"  NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK ("pack_size" > 0),
  "label"      VARCHAR(100),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX "idx_inventory_barcodes_item" ON "inventory_barcodes" ("item_id");
