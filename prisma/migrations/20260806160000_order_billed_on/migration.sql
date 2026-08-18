-- ============================================================
-- BILLED-ON DATE
-- The date a purchase order's liability was recognised: when it reached
-- Received, whether by its last delivery arriving or by being closed short.
--
-- received_on cannot serve this. It marks the FIRST delivery and is never
-- updated afterwards, so an order part delivered on 30 January and completed on
-- 15 February carries received_on = 30 January while only becoming Received in
-- February. A supplier statement filtered on that date would recognise the
-- liability in the wrong period, which is precisely the kind of cut-off error an
-- audit looks for. Partial deliveries are normal here, so this is not
-- hypothetical.
--
-- Also the basis aging is measured from: how long a balance has been outstanding
-- counts from when it became payable, not from when the first box turned up.
-- ============================================================

ALTER TABLE purchase_orders
    ADD COLUMN billed_on DATE;

-- Backfill. Every order already Received was, before this column existed,
-- delivered in one go or closed short on the same day it was first received, so
-- received_on is the best available evidence of when it became payable.
--
-- Falls back through ordered_on to created_at so no Received row can be left
-- NULL: the CHECK below would otherwise abort the whole migration on a single
-- odd row. Orders not yet Received carry no liability and stay NULL.
UPDATE purchase_orders
SET billed_on = COALESCE(received_on, ordered_on, created_at::date)
WHERE status = 'Received'
  AND billed_on IS NULL;

-- An order that is Received must carry the date, so the statement can never
-- silently drop a liability out of every period. Enforced as a trigger-free
-- CHECK because the app is the only writer.
ALTER TABLE purchase_orders
    ADD CONSTRAINT purchase_orders_billed_on_when_received
    CHECK (status <> 'Received' OR billed_on IS NOT NULL);

CREATE INDEX idx_purchase_orders_billed ON purchase_orders(billed_on) WHERE deleted_at IS NULL;
