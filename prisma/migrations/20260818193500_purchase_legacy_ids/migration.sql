-- Legacy keys for the purchase side, so the .mdb import upserts rather than
-- duplicating when it is re-run at cutover.
ALTER TABLE "purchase_orders" ADD COLUMN "legacy_id" INTEGER;
ALTER TABLE "purchase_order_lines" ADD COLUMN "legacy_id" INTEGER;

CREATE UNIQUE INDEX "purchase_orders_legacy_id_key" ON "purchase_orders"("legacy_id");
CREATE UNIQUE INDEX "purchase_order_lines_legacy_id_key" ON "purchase_order_lines"("legacy_id");
