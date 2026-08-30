-- AlterTable
ALTER TABLE "services" ADD COLUMN     "partner_cost_pct" DECIMAL(5,2),
ADD COLUMN     "partner_id" INTEGER,
ADD COLUMN     "partner_profit_pct" DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "idx_services_partner" ON "services"("partner_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("partner_id") ON DELETE SET NULL ON UPDATE CASCADE;
