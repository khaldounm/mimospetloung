-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "category" VARCHAR(100);

-- CreateIndex
CREATE INDEX "idx_purchase_orders_draft_bucket" ON "purchase_orders"("status", "supplier_id", "category");
