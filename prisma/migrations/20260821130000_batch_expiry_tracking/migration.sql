-- Batch and expiry tracking for perishable stock.
--
-- One expiry date on the item cannot express two deliveries of the same drug
-- expiring in different months, so the date moves to the delivery. There is
-- nothing to migrate from the old system: its lot and expiry columns were
-- generic ERP furniture and are empty on all 1,725 purchase lines, all 14,962
-- sale lines and all 2,980 inventory detail rows.

-- Opt in per item. Of the items carrying stock, 641 are accessories and toys
-- that never perish; prompting for a lot number on a nylon harness is how staff
-- learn to type rubbish into the field.
ALTER TABLE "inventory_items"
  ADD COLUMN "tracks_expiry" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "inventory_batches" (
  "batch_id"         SERIAL PRIMARY KEY,
  "item_id"          INTEGER NOT NULL REFERENCES "inventory_items"("item_id") ON DELETE CASCADE,
  "lot_number"       VARCHAR(100),
  "expiry_date"      DATE,
  "quantity"         NUMERIC(10,3) NOT NULL CHECK ("quantity" >= 0),
  "received_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "purchase_line_id" INTEGER,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- The picking order itself: expiry first, nulls before dates because unknown
-- stock is the oldest stock, then oldest delivery. Indexed so first-expiring-
-- first never sorts the table.
CREATE INDEX "idx_batches_item_fefo"
  ON "inventory_batches" ("item_id", "expiry_date", "received_at");

-- Which batches a movement drew from. A sale spanning two lots writes one row
-- per lot while still writing exactly one inventory_transactions row, so every
-- existing movement-to-line pairing keeps working unchanged.
CREATE TABLE "inventory_batch_movements" (
  "id"             SERIAL PRIMARY KEY,
  "transaction_id" INTEGER NOT NULL REFERENCES "inventory_transactions"("transaction_id") ON DELETE CASCADE,
  "batch_id"       INTEGER NOT NULL REFERENCES "inventory_batches"("batch_id") ON DELETE CASCADE,
  "quantity"       NUMERIC(10,3) NOT NULL
);
CREATE INDEX "idx_batch_movements_transaction" ON "inventory_batch_movements" ("transaction_id");
CREATE INDEX "idx_batch_movements_batch" ON "inventory_batch_movements" ("batch_id");

-- Turn tracking on for the categories that actually perish. Accessories, Toys
-- and anything uncategorised are left alone.
UPDATE "inventory_items"
   SET "tracks_expiry" = true
 WHERE "deleted_at" IS NULL
   AND "category" IN ('Medication', 'Supplements', 'Food', 'Treats');

-- Opening batches. Everything already on the shelf becomes one batch with no
-- expiry: honest about the fact that nobody recorded one, and it drains first
-- under the picking order, so within a couple of months of normal turnover the
-- unknown pool is gone and every remaining batch carries a real date.
INSERT INTO "inventory_batches" ("item_id", "quantity", "received_at")
SELECT "item_id", "current_stock", now()
  FROM "inventory_items"
 WHERE "deleted_at" IS NULL
   AND "tracks_expiry" = true
   AND "current_stock" > 0;
