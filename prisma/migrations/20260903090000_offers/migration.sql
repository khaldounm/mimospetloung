-- Offers: a deal the clinic gives, who was given it, and what consumed it.
--
-- Three states of one thing, kept in two tables. The offer is the catalogue
-- entry, a grant is one client holding it, and a redeemed grant names the
-- invoice that spent it. A discount typed straight onto an invoice can answer
-- none of "who did we give this to" or "did they come back".

-- CreateTable
CREATE TABLE "offers" (
    "offer_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "discount_mode" VARCHAR(10) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "expires_on" DATE,
    "archived_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("offer_id")
);

-- CreateTable
CREATE TABLE "offer_grants" (
    "grant_id" SERIAL NOT NULL,
    "offer_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "granted_by" INTEGER,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemed_invoice_id" INTEGER,
    "redeemed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "offer_grants_pkey" PRIMARY KEY ("grant_id")
);

-- CreateIndex
CREATE INDEX "idx_offer_grants_client" ON "offer_grants"("client_id");

-- CreateIndex
CREATE INDEX "idx_offer_grants_offer" ON "offer_grants"("offer_id");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_grants" ADD CONSTRAINT "offer_grants_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("offer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_grants" ADD CONSTRAINT "offer_grants_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_grants" ADD CONSTRAINT "offer_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_grants" ADD CONSTRAINT "offer_grants_redeemed_invoice_id_fkey" FOREIGN KEY ("redeemed_invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One discount typed one way, the same rule invoices_one_discount_mode enforces
-- on an invoice. A row carrying both a percentage and an amount leaves whoever
-- reads it guessing which one the customer actually got.
ALTER TABLE "offers" ADD CONSTRAINT "offers_one_discount_mode" CHECK (
  ("discount_mode" = 'pct'    AND "discount_pct" > 0 AND "discount_amount" = 0)
  OR
  ("discount_mode" = 'amount' AND "discount_amount" > 0 AND "discount_pct" = 0)
);

-- A percentage that is not a percentage is not a discount anyone can honour.
ALTER TABLE "offers" ADD CONSTRAINT "offers_pct_range" CHECK (
  "discount_pct" >= 0 AND "discount_pct" <= 100
);

-- A client holds at most ONE live grant of a given offer. Partial, so the same
-- offer can be given again after the first was spent or revoked, and so two
-- people clicking Grant on the same list at the same time cannot stack two
-- discounts on one client. Not expressible in Prisma.
CREATE UNIQUE INDEX "uq_offer_grants_live"
  ON "offer_grants" ("offer_id", "client_id")
  WHERE "redeemed_at" IS NULL AND "revoked_at" IS NULL;

-- An invoice consumes at most one grant. Same reasoning: an invoice carries a
-- single discount, so a second offer landing on it would silently replace the
-- first and leave two grants marked spent for one discount.
CREATE UNIQUE INDEX "uq_offer_grants_invoice"
  ON "offer_grants" ("redeemed_invoice_id")
  WHERE "redeemed_invoice_id" IS NOT NULL;

-- Keeps updated_at honest, the same trigger every other table uses.
CREATE TRIGGER trg_offers_updated BEFORE UPDATE ON offers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
