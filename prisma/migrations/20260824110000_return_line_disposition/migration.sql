-- What happens to the goods a customer hands back.
--
-- The decision is made at the counter, per line, and it is not the same for
-- every line of one return: three tins come back because the customer only
-- needed one, two of them are perfect and go straight back on the shelf, the
-- third arrived dented and never sells. So this lives on the line, not on the
-- document.
--
--   return_restock   TRUE  goods return to stock
--                    FALSE goods come back and are written off
--
-- A written-off return is still TWO movements at issue, Returned then Damaged,
-- never a suppressed one. The customer's money goes back either way, and the
-- clinic needs "returned 12, wrote off 3" to stay answerable; a return that
-- silently skipped its stock movement would make the loss invisible.
--
-- The lot and expiry are what the item is going back INTO. They are pre-filled
-- from the batch the sale drew from and confirmed by whoever takes the return,
-- so the normal case is a keystroke. They matter because a perishable put back
-- without a date opens an undated batch, and undated batches are picked FIRST
-- by FEFO: an undated return would be pushed out of the door ahead of stock
-- with a known expiry. Typed, scanned off the box via GS1, or carried over from
-- the original sale, but never guessed.
--
-- All three are NULL on the 85 customer returns the loader imported. Those are
-- historical, already settled, and genuinely have no disposition on record;
-- NULL says that rather than inventing one. The loader never writes these
-- columns and is unaffected.

ALTER TABLE invoice_line_items
  ADD COLUMN return_restock     BOOLEAN,
  ADD COLUMN return_lot_number  VARCHAR(100),
  ADD COLUMN return_expiry_date DATE;

-- These only mean anything on a line that is giving something back.
ALTER TABLE invoice_line_items
  ADD CONSTRAINT invoice_lines_return_fields_need_return
  CHECK (
    quantity < 0
    OR (return_restock IS NULL
        AND return_lot_number IS NULL
        AND return_expiry_date IS NULL)
  );
