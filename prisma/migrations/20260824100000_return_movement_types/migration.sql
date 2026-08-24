-- Returns become a movement type of their own, and 'Adjusted' gets its job back.
--
-- 'Adjusted' was doing two unrelated things. One is real: a human corrects a
-- count because the shelf says 7 and the system says 9. The other was a dumping
-- ground, because signedDelta() forced every other type through Math.abs() and
-- 'Adjusted' was the only type that would carry a sign. That is why voiding an
-- invoice wrote 'Adjusted' movements: they are reversals wearing a correction's
-- clothes, and nothing downstream could tell the two apart.
--
-- With directional types for the things that actually have a direction,
-- 'Adjusted' is left meaning exactly one thing, and every other type states
-- what happened rather than which way the number moved.
--
--   Returned            customer brought goods back           stock in
--   ReturnedToSupplier  goods sent back to the supplier       stock out
--   Damaged             written off, incl. a return unfit     stock out
--                       to resell
--
-- A return that cannot be resold is TWO movements, not a flag: Returned puts it
-- back into the lot it left, then Damaged takes it out again. Net zero stock,
-- but "returned 12 this month, wrote off 3" stays answerable, which a single
-- flagged movement would hide.

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_type_check;
ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_type_check
  CHECK (type IN (
    'Received',
    'Used',
    'Sold',
    'Adjusted',
    'Expired',
    'Returned',
    'ReturnedToSupplier',
    'Damaged'
  ));
