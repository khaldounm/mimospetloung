-- ============================================================
-- SUPPLIER PAYMENTS
-- The clinic pays suppliers both on the spot and on credit, so what has been
-- ordered and what has been settled are independent figures. Purchase orders
-- record the first; this table records the second.
--
-- order_id is optional: paying one bill links to that order, while a lump sum
-- against the account links to nothing and simply reduces the balance owed.
-- Soft-deleted so correcting an entry leaves the history intact, matching
-- partner_payouts.
--
-- Note this changes no profit figure. Under the clinic's accrual model cost
-- reaches the P&L as COGS when stock sells, so paying a supplier moves cash and
-- nothing else.
-- ============================================================
CREATE TABLE supplier_payments (
    payment_id  SERIAL PRIMARY KEY,
    supplier_id INT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
    order_id    INT REFERENCES purchase_orders(order_id) ON DELETE SET NULL,
    amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    paid_on     DATE NOT NULL,
    method      VARCHAR(50),
    reference    VARCHAR(100),
    notes       TEXT,
    created_by  INT REFERENCES users(user_id) ON DELETE SET NULL,
    deleted_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_payments_paid ON supplier_payments(paid_on) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_supplier_payments_updated BEFORE UPDATE ON supplier_payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
