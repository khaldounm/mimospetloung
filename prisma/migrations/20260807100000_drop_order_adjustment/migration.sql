-- ============================================================
-- DROP THE SUPERSEDED ADJUSTMENT COLUMNS
-- `adjustment` and `adjustment_note` were a single catch-all for whatever a
-- supplier added to or took off a bill, standing in until the clinic confirmed
-- which charges actually apply. They were replaced in
-- 20260806120000_order_charges_and_partial_receipt by explicit discount_amount,
-- shipping_amount, tax_rate and tax_amount columns, and nothing has read or
-- written them since.
--
-- Kept until now rather than dropped in that migration, so any rows entered
-- during the days the field existed could be inspected first. Confirmed empty:
--
--   SELECT count(*) FROM purchase_orders
--   WHERE adjustment IS NOT NULL OR adjustment_note IS NOT NULL;  -- 0
--
-- This is destructive and not reversible. It is safe only because the columns
-- hold no data; re-run that check before applying to any other database.
-- ============================================================

ALTER TABLE purchase_orders
    DROP COLUMN adjustment,
    DROP COLUMN adjustment_note;
