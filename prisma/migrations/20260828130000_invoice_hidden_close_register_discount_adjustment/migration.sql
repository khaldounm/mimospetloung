-- DropForeignKey
ALTER TABLE "register_closings" DROP CONSTRAINT "register_closings_closed_by_fkey";

-- DropForeignKey
ALTER TABLE "running_costs" DROP CONSTRAINT "running_costs_invoice_line_item_id_fkey";

-- DropForeignKey
ALTER TABLE "running_costs" DROP CONSTRAINT "running_costs_register_closing_id_fkey";

-- AddForeignKey
ALTER TABLE "running_costs" ADD CONSTRAINT "running_costs_invoice_line_item_id_fkey" FOREIGN KEY ("invoice_line_item_id") REFERENCES "invoice_line_items"("line_item_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_costs" ADD CONSTRAINT "running_costs_register_closing_id_fkey" FOREIGN KEY ("register_closing_id") REFERENCES "register_closings"("closing_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_closings" ADD CONSTRAINT "register_closings_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
