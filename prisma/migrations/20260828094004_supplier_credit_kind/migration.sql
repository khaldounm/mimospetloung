-- AlterTable
ALTER TABLE "supplier_payments" ADD COLUMN     "kind" VARCHAR(20) NOT NULL DEFAULT 'Payment';

-- CreateIndex
CREATE INDEX "idx_supplier_payments_kind" ON "supplier_payments"("kind");
