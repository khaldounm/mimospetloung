-- Three changes to how one invoice's money is shaped, all of them things the
-- counter already does by hand on the printed copy.
--
--   discount_amount  a discount typed as money instead of a percentage
--   adjustment       a signed nudge after tax, to land on a round figure
--   is_hidden        a line the customer neither sees nor pays for

-- A discount is one thing said two ways, so it is stored as one thing.
-- Percentage stays the default and every existing invoice keeps its value;
-- discount_amount is the alternative, and the constraint below stops an invoice
-- from carrying both and leaving the reader to guess which one applied.
ALTER TABLE invoices
  ADD COLUMN discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_one_discount_mode
  CHECK (discount_pct = 0 OR discount_amount = 0);

ALTER TABLE invoices
  ADD CONSTRAINT invoices_discount_amount_non_negative
  CHECK (discount_amount >= 0);

-- "Call it 100" is a real thing that happens at a counter, and up to now the
-- only way to do it was to invent a percentage that happened to land there.
--
-- Stored as the DELTA (-1.12), never as the target (100). The difference
-- matters the moment another line goes on: a stored delta lets the total move
-- by that line, where a stored target would swallow it and quietly give the
-- product away. Signed, because rounding goes up as often as down.
ALTER TABLE invoices
  ADD COLUMN adjustment NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Consumables used during the visit: gloves, pads, a syringe. They go on the
-- invoice so the stock leaves the shelf and the spend is on record, and they
-- come off every printed copy so the customer is neither shown nor charged for
-- them. Issuing writes a Used movement and a running cost instead of a sale,
-- which is how the clinic's own consumption reaches analytics.
ALTER TABLE invoice_line_items
  ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Only stock can be consumed. A service has nothing to take off a shelf and no
-- cost to expense, so hiding one would remove it from the bill and leave
-- nothing behind at all.
ALTER TABLE invoice_line_items
  ADD CONSTRAINT invoice_lines_hidden_is_stock
  CHECK (NOT is_hidden OR item_id IS NOT NULL);

-- A return hands goods back and money with them. Hiding one would take the
-- refund off the invoice while still putting the stock back, so the clinic
-- would return goods it never credited.
ALTER TABLE invoice_line_items
  ADD CONSTRAINT invoice_lines_hidden_is_not_return
  CHECK (NOT is_hidden OR quantity > 0);

-- Issuing walks the hidden lines of one invoice; the existing invoice index
-- covers the lookup, and this keeps the partial scan cheap on the big
-- imported invoices.
CREATE INDEX idx_invoice_lines_hidden
  ON invoice_line_items (invoice_id)
  WHERE is_hidden;
