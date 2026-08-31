-- Undo the partner/services test run of 2026-08-30 on production.
--
-- It removes: "Test Partner", "Test service 1" and its 3-row cost recipe, the
-- two invoices billed against it (7774, 7775), their payments, the stock they
-- consumed, the running costs they raised, the 2 accruals and the 1 attendance
-- day. Nothing else is touched.
--
-- WHY THE ORDER MATTERS. This is not a pile of DELETEs; several of these rows
-- moved money and stock, and undoing them in the wrong order leaves the books
-- wrong rather than failing loudly:
--
--   * Stock is restored FROM the movements, before the movements are deleted.
--     Delete them first and there is nothing left to say how much to put back.
--   * Payments must go WITH their invoices. Issuing added the total to the
--     client's balance and paying subtracted it, so both invoices net to zero.
--     Deleting the invoice but keeping the payment (or vice versa) would leave
--     Ramzi Merhi and Khaldoun Al Aridi with a phantom credit or debt.
--     Because they net to zero, no balance adjustment is needed here. Checked.
--   * Accruals block their partner (ON DELETE RESTRICT), so they go first.
--   * Invoice lines go before the service they point at, or the service delete
--     would blank service_id and violate invoice_line_items_check.
--
-- Verified against this database before it was written: no register closing
-- covers 2026-08-30, so no end-of-day snapshot counted these payments; the two
-- items do not track expiry, so there are no batch movements to unwind; and
-- both invoices are fully Paid, which is what makes the balances net out.
--
-- Audit log rows are deliberately LEFT ALONE. It is an audit trail: it is
-- supposed to record that this happened.
--
-- Runs as one transaction and ends in ROLLBACK so you can read the output
-- first. Change the last line to COMMIT when the numbers look right.

BEGIN;

-- ── Before ────────────────────────────────────────────────────────────────
SELECT 'before' AS phase,
       (SELECT count(*) FROM partners)                AS partners,
       (SELECT count(*) FROM partner_accruals)        AS accruals,
       (SELECT count(*) FROM partner_attendance)      AS attendance,
       (SELECT count(*) FROM service_cost_components) AS recipe_rows,
       (SELECT count(*) FROM services WHERE name = 'Test service 1') AS test_services,
       (SELECT current_stock FROM inventory_items WHERE item_id = 618)  AS stock_618,
       (SELECT current_stock FROM inventory_items WHERE item_id = 4324) AS stock_4324,
       (SELECT account_balance FROM clients WHERE client_id = 9)    AS bal_client_9,
       (SELECT account_balance FROM clients WHERE client_id = 1225) AS bal_client_1225;

-- ── 1. Put the consumed stock back, derived from the movements themselves ──
UPDATE inventory_items i
SET    current_stock = i.current_stock - t.delta
FROM  (SELECT item_id, sum(quantity) AS delta
       FROM   inventory_transactions
       WHERE  reference_type = 'invoice' AND reference_id IN (7774, 7775)
       GROUP  BY item_id) t
WHERE i.item_id = t.item_id;

-- ── 2. Then the movements, and the costs the same lines raised ────────────
DELETE FROM inventory_transactions
WHERE reference_type = 'invoice' AND reference_id IN (7774, 7775);

DELETE FROM running_costs
WHERE invoice_line_item_id IN (
  SELECT line_item_id FROM invoice_line_items WHERE invoice_id IN (7774, 7775));

-- ── 3. Partner ledger: accruals restrict the partner, so they lead ────────
DELETE FROM partner_accruals   WHERE invoice_id IN (7774, 7775)
                                  OR partner_id = (SELECT partner_id FROM partners WHERE name = 'Test Partner');
DELETE FROM partner_attendance WHERE partner_id = (SELECT partner_id FROM partners WHERE name = 'Test Partner');

-- ── 4. The documents, payments alongside their invoices ───────────────────
DELETE FROM payments           WHERE invoice_id IN (7774, 7775);
DELETE FROM invoice_line_items WHERE invoice_id IN (7774, 7775);
DELETE FROM invoices           WHERE invoice_id IN (7774, 7775);

-- ── 5. The test service (recipe cascades) and the test partner ────────────
DELETE FROM services WHERE name = 'Test service 1' AND legacy_id IS NULL;
DELETE FROM partners WHERE name = 'Test Partner';

-- ── After. Stock should be +2 on each; balances unchanged; counts at zero ──
SELECT 'after' AS phase,
       (SELECT count(*) FROM partners)                AS partners,
       (SELECT count(*) FROM partner_accruals)        AS accruals,
       (SELECT count(*) FROM partner_attendance)      AS attendance,
       (SELECT count(*) FROM service_cost_components) AS recipe_rows,
       (SELECT count(*) FROM services WHERE name = 'Test service 1') AS test_services,
       (SELECT current_stock FROM inventory_items WHERE item_id = 618)  AS stock_618,
       (SELECT current_stock FROM inventory_items WHERE item_id = 4324) AS stock_4324,
       (SELECT account_balance FROM clients WHERE client_id = 9)    AS bal_client_9,
       (SELECT account_balance FROM clients WHERE client_id = 1225) AS bal_client_1225;

-- Any line left pointing at nothing would be a bug in the above. Expect 0.
SELECT count(*) AS orphaned_lines
FROM invoice_line_items WHERE service_id IS NULL AND item_id IS NULL;

ROLLBACK;  -- <<< change to COMMIT to apply
