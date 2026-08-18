-- Legacy key for supplier payments, so the .mdb import upserts rather than
-- duplicating when it is re-run at cutover.
ALTER TABLE "supplier_payments" ADD COLUMN "legacy_id" INTEGER;
CREATE UNIQUE INDEX "supplier_payments_legacy_id_key" ON "supplier_payments"("legacy_id");
