/*
  Warnings:

  - Added the required column `client_id` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "client_id" INTEGER NOT NULL,
ALTER COLUMN "invoice_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "account_balance" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "idx_payments_client" ON "payments"("client_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE RESTRICT ON UPDATE CASCADE;
