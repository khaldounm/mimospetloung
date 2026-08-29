-- Consignment partners get the carry-forward that clients and suppliers already
-- have.
--
-- A partner's balance is `accrued - paidToDate`, where accrued is summed from
-- sale movements on inventory_transactions and paid comes from partner_payouts.
-- Both of those are rows a year-end prune removes, so without a figure to carry
-- forward a prune would reset every partner balance in the clinic's favour.
--
-- Done now, ahead of any archiving work, because there are no partners yet and
-- so there is nothing to backfill. Once the clinic takes one on, this stops
-- being free.
ALTER TABLE "opening_balances" ADD COLUMN "partner_id" INTEGER;

ALTER TABLE "opening_balances"
  ADD CONSTRAINT "opening_balances_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "partners"("partner_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- One opening balance per partner per date, matching the client and supplier
-- rules: the import stays idempotent and a duplicated figure is impossible.
CREATE UNIQUE INDEX "uq_opening_balance_partner"
  ON "opening_balances" ("partner_id", "as_of_date");

-- The one-party rule becomes a three-way exactly-one. The old constraint read
-- (client_id IS NULL) <> (supplier_id IS NULL), which every partner row would
-- fail: both of those are NULL, so the inequality is false and the row is
-- rejected. Replaced rather than added to, so there is only ever one statement
-- of the rule.
ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_one_party";

ALTER TABLE "opening_balances"
  ADD CONSTRAINT "opening_balances_one_party"
  CHECK (
    ("client_id" IS NOT NULL)::int
    + ("supplier_id" IS NOT NULL)::int
    + ("partner_id" IS NOT NULL)::int
    = 1
  );
