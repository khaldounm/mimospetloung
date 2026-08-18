-- ============================================================
-- ORDER CHARGES + PARTIAL RECEIPT
-- The clinic confirmed supplier bills carry VAT (one rate, 11%), delivery and
-- discounts, and that short deliveries are normal with the remainder arriving
-- later. This replaces the single catch-all adjustment with explicit charges,
-- and adds the Partial status an order sits in between its first delivery and
-- its last.
--
-- Stacks on a live database: every change is additive, and the superseded
-- adjustment columns are left in place rather than dropped, so any rows already
-- entered in production survive. A later cleanup drops them once confirmed empty.
-- ============================================================

ALTER TABLE purchase_orders
    ADD COLUMN discount_amount NUMERIC(12,2) CHECK (discount_amount >= 0),
    ADD COLUMN shipping_amount NUMERIC(12,2) CHECK (shipping_amount >= 0),
    ADD COLUMN tax_rate        NUMERIC(5,2)  CHECK (tax_rate >= 0 AND tax_rate <= 100),
    ADD COLUMN tax_amount      NUMERIC(12,2) CHECK (tax_amount >= 0);

COMMENT ON COLUMN purchase_orders.adjustment IS
    'Superseded by discount_amount / shipping_amount / tax_amount. No longer written. Drop once confirmed empty.';
COMMENT ON COLUMN purchase_orders.adjustment_note IS
    'Superseded by the explicit charge columns. No longer written.';

-- Partial: some lines delivered, the rest still expected. Received now means
-- fully settled, whether everything arrived or the order was closed short.
--
-- The original constraint was declared inline, so Postgres named it. Look the
-- name up rather than assuming it, so this cannot fail against a database whose
-- constraint was auto-named differently.
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'purchase_orders'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE purchase_orders DROP CONSTRAINT %I',
            constraint_name
        );
    END IF;
END $$;

ALTER TABLE purchase_orders
    ADD CONSTRAINT purchase_orders_status_check
    CHECK (status IN ('Draft', 'Placed', 'Partial', 'Received', 'Cancelled'));

-- A line can never be delivered more than was ordered. Enforced here rather than
-- in the app because repeat receipts increment this column over several calls.
ALTER TABLE purchase_order_lines
    ADD CONSTRAINT po_lines_received_within_ordered
    CHECK (quantity_received <= quantity_ordered);
