-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "performed_by_partner_id" INTEGER;

-- CreateTable
CREATE TABLE "partner_accruals" (
    "accrual_id" SERIAL NOT NULL,
    "partner_id" INTEGER NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "invoice_id" INTEGER,
    "line_item_id" INTEGER,
    "earned_on" DATE NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,
    "cost_basis" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "cost_part" DECIMAL(12,2) NOT NULL,
    "reversed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_accruals_pkey" PRIMARY KEY ("accrual_id")
);

-- CreateIndex
CREATE INDEX "idx_partner_accruals_partner_day" ON "partner_accruals"("partner_id", "earned_on");

-- CreateIndex
CREATE INDEX "idx_partner_accruals_invoice" ON "partner_accruals"("invoice_id");

-- AddForeignKey
ALTER TABLE "partner_accruals" ADD CONSTRAINT "partner_accruals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("partner_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_accruals" ADD CONSTRAINT "partner_accruals_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_accruals" ADD CONSTRAINT "partner_accruals_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "invoice_line_items"("line_item_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_performed_by_partner_id_fkey" FOREIGN KEY ("performed_by_partner_id") REFERENCES "partners"("partner_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The two sources this table accepts. A CHECK rather than a Prisma enum, for
-- the same reason every other status column here is one: the DB is the
-- authority on what is storable, and the TS union in types/enums mirrors it.
ALTER TABLE "partner_accruals"
  ADD CONSTRAINT "partner_accruals_source" CHECK ("source" IN ('service', 'guarantee'));
