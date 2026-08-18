-- The invoice list is ordered newest-first and filtered by status. Without
-- these it sequentially scans and sorts every invoice on each page load, which
-- an 8-month import already makes expensive and further years would multiply.
CREATE INDEX IF NOT EXISTS "idx_invoices_created_at"
  ON "invoices" ("created_at" DESC, "invoice_id" DESC);

-- Serves the status filter while keeping the same ordering, so a filtered page
-- reads straight from the index instead of sorting the matches.
CREATE INDEX IF NOT EXISTS "idx_invoices_status_created_at"
  ON "invoices" ("status", "created_at" DESC, "invoice_id" DESC);
