-- ============================================================
-- RUNNING COSTS (operating expenses)
-- Dated operating-cost entries that feed the analytics net-profit figures.
-- Admin-only at the application layer. Soft-deleted so historical profit
-- reports stay reproducible. updated_at maintained by the shared trigger.
-- ============================================================
CREATE TABLE running_costs (
    cost_id     SERIAL PRIMARY KEY,
    category    VARCHAR(100) NOT NULL,
    description VARCHAR(200) NOT NULL,
    amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    incurred_on DATE NOT NULL,
    notes       TEXT,
    created_by  INT REFERENCES users(user_id) ON DELETE SET NULL,
    deleted_at  TIMESTAMPTZ,                       -- soft delete (keeps profit history reproducible)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_running_costs_incurred ON running_costs(incurred_on) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_running_costs_updated BEFORE UPDATE ON running_costs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
