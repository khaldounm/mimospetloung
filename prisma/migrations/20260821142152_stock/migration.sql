/*
  Warnings:

  - Made the column `line_total` on table `invoice_line_items` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "inventory_barcodes" DROP CONSTRAINT "inventory_barcodes_item_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_batch_movements" DROP CONSTRAINT "inventory_batch_movements_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_batch_movements" DROP CONSTRAINT "inventory_batch_movements_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_batches" DROP CONSTRAINT "inventory_batches_item_id_fkey";

-- AlterTable
ALTER TABLE "invoice_line_items" ALTER COLUMN "line_total" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "inventory_barcodes" ADD CONSTRAINT "inventory_barcodes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("item_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("item_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batch_movements" ADD CONSTRAINT "inventory_batch_movements_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "inventory_transactions"("transaction_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batch_movements" ADD CONSTRAINT "inventory_batch_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
