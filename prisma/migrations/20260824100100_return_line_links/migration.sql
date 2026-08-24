-- Which sale (or delivery) a return line undoes.
--
-- The sign already says a line is a return: negative quantity, positive price,
-- the same rule both sides of the ledger have followed since
-- 20260820150000_purchase_returns, and the same rule the old Access system used
-- for the 85 customer returns and 5 supplier returns the loader brought across.
-- What the sign cannot say is WHICH line is being undone, and without that:
--
--   * "3 tins sold, 2 returned" cannot be checked, so the same tin can be
--     returned over and over;
--   * a perishable return has no lot to go back into, and would open a fresh
--     undated batch that FEFO then picks ahead of stock with a known expiry.
--
-- Nullable, and the loader never sets it: a legacy return still imports as a
-- bare negative line and is simply untraceable, which is the truth about it.
--
-- ON DELETE SET NULL rather than CASCADE. A return line is its own event with
-- its own money and its own stock movement; losing the original must cost it
-- its provenance, never its existence. In practice the original cannot go: line
-- items are only deletable while their invoice is Draft, and a return can only
-- point at a line that has already been issued.

ALTER TABLE invoice_line_items
  ADD COLUMN returned_from_line_id INT
  REFERENCES invoice_line_items(line_item_id) ON DELETE SET NULL;

ALTER TABLE purchase_order_lines
  ADD COLUMN returned_from_line_id INT
  REFERENCES purchase_order_lines(line_id) ON DELETE SET NULL;

-- A line that says what it undoes must be going the other way. This is what
-- keeps the sign convention honest without every call site having to remember
-- it. Legacy rows leave the column NULL and are unaffected.
ALTER TABLE invoice_line_items
  ADD CONSTRAINT invoice_lines_return_is_negative
  CHECK (returned_from_line_id IS NULL OR quantity < 0);

ALTER TABLE purchase_order_lines
  ADD CONSTRAINT po_lines_return_is_negative
  CHECK (returned_from_line_id IS NULL OR quantity_ordered < 0);

-- "How much of this line has already been returned" runs on every return, so it
-- reads an index rather than scanning 15,791 line items.
CREATE INDEX idx_invoice_lines_returned_from
  ON invoice_line_items(returned_from_line_id)
  WHERE returned_from_line_id IS NOT NULL;

CREATE INDEX idx_po_lines_returned_from
  ON purchase_order_lines(returned_from_line_id)
  WHERE returned_from_line_id IS NOT NULL;
