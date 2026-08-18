-- ============================================================
-- SUPPLIERS (companies the clinic buys stock from)
-- A supplier sells product to the clinic, which pays for it and owns it
-- outright. Distinct from a partner, who finances stock and shares its profit:
-- a supplier has no claim on a sale. Soft-deleted so historical purchase orders
-- keep naming who they were placed with. updated_at maintained by the shared
-- trigger.
-- ============================================================
CREATE TABLE suppliers (
    supplier_id    SERIAL PRIMARY KEY,
    name           VARCHAR(120) NOT NULL,
    contact_person VARCHAR(120),
    phone          VARCHAR(40),
    email          VARCHAR(160),
    notes          TEXT,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at     TIMESTAMPTZ,                     -- soft delete (keeps order history reproducible)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_active ON suppliers(name) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The company an item is usually reordered from. Advisory only: it groups the
-- reorder basket by supplier and does not constrain who an order is placed
-- with. Independent of partner_id, so an item can have both, either, or
-- neither. NULL means "not assigned yet", which is every item before this ships.
ALTER TABLE inventory_items
    ADD COLUMN supplier_id INT REFERENCES suppliers(supplier_id) ON DELETE SET NULL;

CREATE INDEX idx_inventory_items_supplier ON inventory_items(supplier_id) WHERE supplier_id IS NOT NULL;
