-- ============================================================
-- PURCHASE ORDERS (reordering stock from suppliers)
-- A Draft order is the "future order" the low-stock basket fills. It becomes
-- Placed once sent to the supplier, then Received when the stock arrives, which
-- writes the matching Received inventory movements.
--
-- supplier_id is nullable so items with no usual supplier still have somewhere
-- to collect; the app refuses to move such an order past Draft.
--
-- Deliberately carries no payment columns: under the clinic's accrual model an
-- order never touches profit, since cost reaches the P&L as COGS when the stock
-- sells. What was paid, and when, is tracked separately.
-- ============================================================
CREATE TABLE purchase_orders (
    order_id        SERIAL PRIMARY KEY,
    supplier_id     INT REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
    status          VARCHAR(20) NOT NULL DEFAULT 'Draft'
                    CHECK (status IN ('Draft', 'Placed', 'Received', 'Cancelled')),
    reference       VARCHAR(100),                    -- the supplier's own order / invoice number
    ordered_on      DATE,
    received_on     DATE,
    adjustment      NUMERIC(12,2),                   -- VAT / delivery / discount, until the clinic confirms which apply
    adjustment_note VARCHAR(200),
    notes           TEXT,
    created_by      INT REFERENCES users(user_id) ON DELETE SET NULL,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_purchase_orders_updated BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One item per order. quantity_received is carried from the start even though
-- the receive flow is all-or-nothing today, so supporting partial deliveries
-- later is a UI change rather than a migration.
CREATE TABLE purchase_order_lines (
    line_id           SERIAL PRIMARY KEY,
    order_id          INT NOT NULL REFERENCES purchase_orders(order_id) ON DELETE CASCADE,
    item_id           INT NOT NULL REFERENCES inventory_items(item_id) ON DELETE RESTRICT,
    quantity_ordered  NUMERIC(10,2) NOT NULL CHECK (quantity_ordered > 0),
    quantity_received NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_cost         NUMERIC(12,2) CHECK (unit_cost >= 0),
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adding an item already on the order bumps its quantity instead of creating a
-- second line.
CREATE UNIQUE INDEX uq_po_lines_order_item ON purchase_order_lines(order_id, item_id);
CREATE INDEX idx_po_lines_order ON purchase_order_lines(order_id);

CREATE TRIGGER trg_po_lines_updated BEFORE UPDATE ON purchase_order_lines
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
