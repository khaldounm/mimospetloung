-- DropForeignKey
ALTER TABLE "invoice_line_items" DROP CONSTRAINT "invoice_line_items_returned_from_line_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order_lines" DROP CONSTRAINT "purchase_order_lines_returned_from_line_id_fkey";

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_returned_from_line_id_fkey" FOREIGN KEY ("returned_from_line_id") REFERENCES "purchase_order_lines"("line_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_returned_from_line_id_fkey" FOREIGN KEY ("returned_from_line_id") REFERENCES "invoice_line_items"("line_item_id") ON DELETE SET NULL ON UPDATE CASCADE;
