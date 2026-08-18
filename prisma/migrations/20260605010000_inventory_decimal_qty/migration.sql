-- Allow fractional stock quantities (e.g. 0.1, 0.2, 2.5) for items dispensed by
-- partial units such as anaesthesia or liquids. Stock level and stock movements
-- move from integer to NUMERIC(10,2). The current_stock >= 0 CHECK and the
-- low-stock index are preserved automatically across the type change.
ALTER TABLE inventory_items
    ALTER COLUMN current_stock TYPE NUMERIC(10,2) USING current_stock::numeric,
    ALTER COLUMN current_stock SET DEFAULT 0;

ALTER TABLE inventory_transactions
    ALTER COLUMN quantity TYPE NUMERIC(10,2) USING quantity::numeric;
