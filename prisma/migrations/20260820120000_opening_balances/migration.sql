-- CreateTable
CREATE TABLE "opening_balances" (
    "opening_balance_id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "supplier_id" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,
    "as_of_date" DATE NOT NULL,
    "source" VARCHAR(200) NOT NULL,
    "source_ref" VARCHAR(100),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_balances_pkey" PRIMARY KEY ("opening_balance_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_opening_balance_client" ON "opening_balances"("client_id", "as_of_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_opening_balance_supplier" ON "opening_balances"("supplier_id", "as_of_date");

-- AddForeignKey
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- An opening balance belongs to exactly one party. Prisma cannot express this,
-- so it lives here; it is a check constraint, not an index, so `migrate dev`
-- does not treat it as drift and try to drop it.
ALTER TABLE "opening_balances"
  ADD CONSTRAINT "opening_balances_one_party"
  CHECK (("client_id" IS NULL) <> ("supplier_id" IS NULL));

-- An opening balance is a statement of fact as at a date, not a mutable field.
-- Correcting one means adding a visible adjustment, never rewriting history, so
-- the database refuses updates and deletes outright rather than relying on
-- every future caller to remember.
CREATE OR REPLACE FUNCTION opening_balances_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'opening_balances is immutable: record a correcting adjustment instead of %',
    lower(TG_OP);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opening_balances_no_update
  BEFORE UPDATE OR DELETE ON "opening_balances"
  FOR EACH ROW EXECUTE FUNCTION opening_balances_immutable();
