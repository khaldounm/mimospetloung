-- 'Opening' records the stock position an item was carried into this system
-- with, so the ledger foots to current_stock without inventing receipts.
--
-- The legacy import brings across every sale and every purchase the Access
-- system recorded, but Access opened mid-life: an item that had 40 bags on the
-- shelf on day one was never "received" inside the imported window. Without a
-- row saying so, the ledger would claim the clinic sold stock it never bought,
-- and current_stock (seeded from the old system's own count) would disagree
-- with the sum of its movements by exactly the amount carried in.
--
-- It is NOT 'Adjusted'. A correction says the shelf and the system disagreed
-- and a human picked the shelf. An opening says nothing was ever wrong: this is
-- where the story starts. Conflating them would put every imported item into
-- the count-corrections report on day one and bury the real ones.
--
-- Signed, because 31 items sold more than the imported window ever purchased.
-- Those get a negative opening and a needs_review flag rather than a silent
-- zero, because the honest reading is "the old data is incomplete here", not
-- "this item started at nothing".

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
    'Damaged',
    'Opening'
  ));
