-- Returns to a supplier: a purchase line with a negative quantity.
--
-- The old Access system records a return as a negative-quantity line on an
-- ordinary purchase invoice, and the loader was dropping those lines because
-- quantity_ordered had to be positive. The money went with them, so every
-- return silently inflated what the clinic appeared to owe its supplier. This
-- is not specific to any one supplier: any supplier that accepts returns hits
-- it, and it grows with whoever returns most.
--
-- The sign lives on the quantity, never on the cost: a returned item cost what
-- it cost, and unit_cost stays >= 0 so line total = quantity * unit_cost comes
-- out negative on its own and nets against the balance without any special case
-- anywhere downstream.

-- 0 is still meaningless on a line; negative now means returned.
ALTER TABLE purchase_order_lines
  DROP CONSTRAINT IF EXISTS purchase_order_lines_quantity_ordered_check;
ALTER TABLE purchase_order_lines
  ADD CONSTRAINT purchase_order_lines_quantity_ordered_check
  CHECK (quantity_ordered <> 0);

-- quantity_received must match the sign of what was ordered and never exceed it
-- in magnitude. Replaces the two constraints that assumed both were positive:
-- a return of 2 units is ordered -2 / received -2, and receiving nothing is 0
-- in either direction.
ALTER TABLE purchase_order_lines
  DROP CONSTRAINT IF EXISTS purchase_order_lines_quantity_received_check;
ALTER TABLE purchase_order_lines
  DROP CONSTRAINT IF EXISTS po_lines_received_within_ordered;
ALTER TABLE purchase_order_lines
  ADD CONSTRAINT po_lines_received_within_ordered
  CHECK (
    quantity_received = 0
    OR (quantity_ordered > 0 AND quantity_received > 0 AND quantity_received <= quantity_ordered)
    OR (quantity_ordered < 0 AND quantity_received < 0 AND quantity_received >= quantity_ordered)
  );
