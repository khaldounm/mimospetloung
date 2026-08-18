/*
  Warnings:

  - A unique constraint covering the columns `[legacy_id]` on the table `clients` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[legacy_id]` on the table `inventory_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[legacy_id]` on the table `invoice_line_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[legacy_id]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[legacy_id]` on the table `patients` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[legacy_id]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[legacy_id]` on the table `services` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[legacy_id]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "legacy_id" INTEGER,
ADD COLUMN     "phone2" VARCHAR(20);

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "legacy_id" INTEGER;

-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "legacy_id" INTEGER;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "legacy_id" INTEGER;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "legacy_id" INTEGER;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "legacy_id" INTEGER;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "legacy_id" INTEGER;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "legacy_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "clients_legacy_id_key" ON "clients"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_legacy_id_key" ON "inventory_items"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_line_items_legacy_id_key" ON "invoice_line_items"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_legacy_id_key" ON "invoices"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_legacy_id_key" ON "patients"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_legacy_id_key" ON "payments"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_legacy_id_key" ON "services"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_legacy_id_key" ON "suppliers"("legacy_id");
