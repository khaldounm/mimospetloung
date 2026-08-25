-- Split a partner's single profit-share rate into two independent rates: what
-- share of an item's cost returns to them, and what share of the profit. One
-- formula then covers every deal shape (cost back plus a cut, a discounted cost
-- share, an uplift on cost, or a pure profit split) with no special cases.
--
-- Written as RENAME rather than DROP + ADD so existing agreed rates survive.
-- Defaulting cost to 100 reproduces the previous behaviour exactly: every deal
-- in force returned the partner's full cost, so no payout changes on migrating.

-- Partners: rename the profit rate, add the cost rate.
ALTER TABLE "partners" RENAME COLUMN "default_share_pct" TO "default_profit_pct";
ALTER TABLE "partners" ADD COLUMN "default_cost_pct" DECIMAL(5,2) NOT NULL DEFAULT 100;

-- Inventory items: same split for the per-item override. Both stay nullable,
-- and they override independently, so an item can take a custom cost rate while
-- still following the partner's default profit rate.
ALTER TABLE "inventory_items" RENAME COLUMN "partner_share_pct" TO "partner_profit_pct";
ALTER TABLE "inventory_items" ADD COLUMN "partner_cost_pct" DECIMAL(5,2);

-- Inventory transactions: freeze how much of each payout was the cost half.
-- Once the cost rate can be anything other than 100, subtracting the item's cost
-- from the payable no longer recovers the profit share, so the split has to be
-- recorded at the time of sale rather than derived later.
--
-- Left NULL for movements written before this point. Those all ran at a 100%
-- cost rate, so the reader falls back to quantity * unit_cost for them, which is
-- what they actually accrued.
ALTER TABLE "inventory_transactions" ADD COLUMN "partner_cost_part" DECIMAL(12,2);
