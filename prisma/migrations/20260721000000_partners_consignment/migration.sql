-- ============================================================
-- PARTNERS (outsourced / consignment inventory)
-- A partner (e.g. a family member) fronts the purchase cost of certain
-- inventory items. When such an item sells, the clinic owes the partner their
-- cost back plus an agreed share of the profit. Soft-deleted so historical
-- balances stay reproducible. updated_at maintained by the shared trigger.
-- ============================================================
CREATE TABLE partners (
    partner_id        SERIAL PRIMARY KEY,
    name              VARCHAR(120) NOT NULL,
    phone             VARCHAR(40),
    default_share_pct NUMERIC(5,2) NOT NULL DEFAULT 0
                      CHECK (default_share_pct >= 0 AND default_share_pct <= 100),
    notes             TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at        TIMESTAMPTZ,                     -- soft delete (keeps balance history reproducible)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partners_active ON partners(name) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_partners_updated BEFORE UPDATE ON partners
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Payouts recorded when the clinic actually pays a partner. The running balance
-- owed is (sum of accrued payable on sales) minus (sum of payouts).
CREATE TABLE partner_payouts (
    payout_id  SERIAL PRIMARY KEY,
    partner_id INT NOT NULL REFERENCES partners(partner_id) ON DELETE RESTRICT,
    amount     NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    paid_on    DATE NOT NULL,
    method     VARCHAR(50),
    reference  VARCHAR(100),
    notes      TEXT,
    created_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partner_payouts_partner ON partner_payouts(partner_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_partner_payouts_updated BEFORE UPDATE ON partner_payouts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Link inventory items to a sourcing partner + the agreed profit-share %.
-- A NULL partner_id means clinic-owned stock (unchanged behaviour).
-- partner_share_pct overrides the partner's default_share_pct when set.
ALTER TABLE inventory_items
    ADD COLUMN partner_id INT REFERENCES partners(partner_id) ON DELETE SET NULL,
    ADD COLUMN partner_share_pct NUMERIC(5,2)
        CHECK (partner_share_pct >= 0 AND partner_share_pct <= 100);

CREATE INDEX idx_inventory_items_partner ON inventory_items(partner_id) WHERE partner_id IS NOT NULL;

-- Freeze the amount owed to the partner on the Sold movement at issue time (and
-- its negation on a void reversal), mirroring how unit_cost is frozen for COGS.
-- partner_payable = cost back + share% of profit, for that sale line.
ALTER TABLE inventory_transactions
    ADD COLUMN partner_id INT REFERENCES partners(partner_id) ON DELETE SET NULL,
    ADD COLUMN partner_payable NUMERIC(12,2);

CREATE INDEX idx_invtx_partner ON inventory_transactions(partner_id) WHERE partner_id IS NOT NULL;
