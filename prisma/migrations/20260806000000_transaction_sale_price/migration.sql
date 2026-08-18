-- ============================================================
-- FREEZE SALE PRICE ON STOCK MOVEMENTS
-- unit_cost is already frozen on a Sold movement so COGS survives a later change
-- to the item's cost. Sale price was not, which meant revenue could only be had
-- by joining back to the invoice through the loose reference_type/reference_id
-- pair, and attributing it to a partner depended on the item's *current*
-- partner_id rather than the one frozen on the movement.
--
-- With both frozen here, revenue, cost and profit all read from this one table.
-- ============================================================

ALTER TABLE inventory_transactions
    ADD COLUMN sale_price NUMERIC(12,2) CHECK (sale_price >= 0);

-- Backfill from the invoice lines that produced each movement. One movement is
-- created per line at issue time, so (reference_id, item_id) locates the line.
-- Where one invoice carried the same item on several lines, the weighted average
-- unit price is the honest reconstruction: the individual lines can no longer be
-- told apart, but their total revenue is preserved.
--
-- This deliberately also fills the Adjusted reversals a void writes, which carry
-- the same reference pair. Their quantity is positive where a Sold is negative,
-- so a voided sale nets its revenue back out exactly as it already nets out cost.
UPDATE inventory_transactions t
SET sale_price = l.unit_price
FROM (
    SELECT invoice_id,
           item_id,
           SUM(line_total) / NULLIF(SUM(quantity), 0) AS unit_price
    FROM invoice_line_items
    WHERE item_id IS NOT NULL
    GROUP BY invoice_id, item_id
) l
WHERE t.reference_type = 'invoice'
  AND t.reference_id = l.invoice_id
  AND t.item_id = l.item_id
  AND t.sale_price IS NULL;
