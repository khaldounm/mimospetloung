-- Loose selling, and the quantity precision it needs.
--
-- PRECISION
-- Quantity moves from 2 to 3 decimal places. At 2dp the smallest expressible
-- slice of a pack is packSize/100, which on a 20kg sack is 200g: a 1.5kg scoop
-- is 0.075 of a bag but stores as 0.08, over-deducting 100g. Identical scoops
-- round the same way every time, so the error is systematic rather than random
-- and compounds to roughly 6% over a bag. At 3dp the worst case is 10g, and any
-- scoop that is a multiple of 20g divides exactly into a 20kg bag.
--
-- Money stays at 2 decimal places everywhere. Only quantity widens, and
-- widening a NUMERIC is lossless.
--
-- line_total is GENERATED ALWAYS AS (quantity * unit_price) STORED, and
-- Postgres refuses to alter a column that a generated column depends on. It is
-- dropped and recreated around the change; nothing is lost because it is
-- recomputed from the two columns it was always derived from.
ALTER TABLE "invoice_line_items" DROP COLUMN "line_total";
ALTER TABLE "invoice_line_items" ALTER COLUMN "quantity" TYPE NUMERIC(10,3);
ALTER TABLE "invoice_line_items"
  ADD COLUMN "line_total" NUMERIC(12,2)
  GENERATED ALWAYS AS ("quantity" * "unit_price") STORED;

ALTER TABLE "inventory_items"        ALTER COLUMN "current_stock"     TYPE NUMERIC(10,3);
ALTER TABLE "inventory_transactions" ALTER COLUMN "quantity"          TYPE NUMERIC(10,3);
ALTER TABLE "purchase_order_lines"   ALTER COLUMN "quantity_ordered"  TYPE NUMERIC(10,3);
ALTER TABLE "purchase_order_lines"   ALTER COLUMN "quantity_received" TYPE NUMERIC(10,3);

-- LOOSE CONFIGURATION
-- Describes how a pack is broken open and sold: the unit it is asked for in,
-- how many of those are in one pack, and what one costs the customer.
--
-- loose_price is an INDEPENDENT price and must never be derived as
-- sale_price / loose_per_unit. Loose sells at a markup: in the legacy data a
-- vial with a $15.60 catalogue price was billed at $24 to $32 when drawn in
-- fractions, with staff inventing the figure each time.
--
-- All three together or all null. An item with them null behaves exactly as it
-- always has, which is what lets this be switched on item by item rather than
-- decided for the whole catalogue up front.
ALTER TABLE "inventory_items"
  ADD COLUMN "loose_unit"     VARCHAR(20),
  ADD COLUMN "loose_per_unit" NUMERIC(10,3),
  ADD COLUMN "loose_price"    NUMERIC(12,2);

ALTER TABLE "inventory_items"
  ADD CONSTRAINT "chk_inventory_items_loose"
  CHECK (
    ("loose_unit" IS NULL AND "loose_per_unit" IS NULL AND "loose_price" IS NULL)
    OR ("loose_unit" IS NOT NULL AND "loose_per_unit" > 0 AND "loose_price" >= 0)
  );

-- WHAT WAS TYPED
-- Records the loose amount as keyed ("2 kg", "200 kg") so the printed invoice
-- and the order read the way the transaction actually happened. Record only:
-- quantity and quantity_ordered stay in stocking units and remain what every
-- calculation reads, which is why stock, COGS and partner payouts needed no
-- changes at all for loose selling.
ALTER TABLE "invoice_line_items"
  ADD COLUMN "loose_qty"  NUMERIC(10,3),
  ADD COLUMN "loose_unit" VARCHAR(20);

ALTER TABLE "purchase_order_lines"
  ADD COLUMN "loose_qty"  NUMERIC(10,3),
  ADD COLUMN "loose_unit" VARCHAR(20);
