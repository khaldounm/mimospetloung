-- Money going back out of the drawer.
--
-- A return could already credit the account: the document total goes negative
-- and what the customer owes falls, or falls past zero into credit. What it
-- could not do is hand cash back, because a payment had to be positive. That
-- made the one case the counter meets most often, a customer paid in full who
-- wants their money rather than a credit, impossible to record honestly.
--
-- A refund is not a second kind of transaction. It is a payment against a
-- document whose total is negative, so it settles that document exactly the way
-- a payment settles a sale, and reduces collected revenue by moving through the
-- same rows the analytics already read. The sign is applied server-side from the
-- invoice's own total; the counter types an amount and never a minus.
--
-- Zero stays meaningless, which is what the original constraint was really for.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount <> 0);

-- amount_original follows amount: it is what physically crossed the counter, in
-- the currency it crossed in, and a drawer counted at close has to net the
-- refunds out. It never carried a constraint, so this is a comment rather than
-- a change, but the sign convention is the same one.
COMMENT ON COLUMN payments.amount_original IS
  'What was physically handed over, in the tendered currency. Negative on a refund, matching amount.';
