-- Closing the register used to be a calculator that vanished with the dialog.
-- The receptionist counted the till, the screen said whether it worked out, and
-- then there was nothing: no record that the day had been counted, by whom, or
-- what it came to. An owner back from a week away had a week of missing days.
--
-- One row per business date, holding what was counted and what the app expected
-- at that moment.

CREATE TABLE register_closings (
  closing_id    SERIAL PRIMARY KEY,
  -- The clinic's day, not the server's. Vercel runs in UTC, and a plain
  -- local-midnight boundary cuts the counter's day at 2am Beirut time.
  business_date DATE NOT NULL UNIQUE,
  -- The rate the two drawers were reconciled against each other at.
  fx_rate       NUMERIC(18, 6) NOT NULL,

  opening_usd  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  opening_lbp  NUMERIC(18, 2) NOT NULL DEFAULT 0,
  taken_usd    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  taken_lbp    NUMERIC(18, 2) NOT NULL DEFAULT 0,
  refunded_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  refunded_lbp NUMERIC(18, 2) NOT NULL DEFAULT 0,
  paid_out_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_out_lbp NUMERIC(18, 2) NOT NULL DEFAULT 0,
  expected_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expected_lbp NUMERIC(18, 2) NOT NULL DEFAULT 0,
  counted_usd  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  counted_lbp  NUMERIC(18, 2) NOT NULL DEFAULT 0,
  -- Both drawers together in USD. A day short in dollars and over in lira by
  -- the same value is a currency mix-up, not a loss, and only the combined
  -- figure says so.
  variance_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,

  notes     TEXT,
  closed_by INT REFERENCES users (user_id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- Every figure above is a SNAPSHOT, deliberately. taken/refunded/expected are
-- what the documents said at the moment of counting and are never re-derived on
-- read: a payment corrected next week would otherwise rewrite the past and turn
-- a day that balanced into a day that did not.
COMMENT ON TABLE register_closings IS
  'End-of-day drawer count, one row per business date. All figures are frozen at close.';

CREATE INDEX idx_register_closings_date ON register_closings (business_date DESC);

-- Cash drawn out of the till, and consumables used on an invoice, are both
-- operating costs, so they are stored as running costs and reach analytics with
-- no special-casing: same table, same categories, same breakdown.
--
-- These columns exist only so the source document can find its own rows again.
-- Voiding an invoice retires the costs its hidden lines raised, and re-closing
-- a day replaces its draws rather than filing them twice. Both null on a cost
-- typed in by hand, which stays the normal case.
ALTER TABLE running_costs
  ADD COLUMN invoice_line_item_id INT
    REFERENCES invoice_line_items (line_item_id) ON DELETE CASCADE,
  ADD COLUMN register_closing_id INT
    REFERENCES register_closings (closing_id) ON DELETE CASCADE;

-- A cost comes from one place or from nobody.
ALTER TABLE running_costs
  ADD CONSTRAINT running_costs_single_source
  CHECK (invoice_line_item_id IS NULL OR register_closing_id IS NULL);

CREATE INDEX idx_running_costs_line_item
  ON running_costs (invoice_line_item_id)
  WHERE invoice_line_item_id IS NOT NULL;

CREATE INDEX idx_running_costs_closing
  ON running_costs (register_closing_id)
  WHERE register_closing_id IS NOT NULL;
