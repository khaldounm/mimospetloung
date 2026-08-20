-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "attending_vet_id" INTEGER,
ADD COLUMN     "fx_rate" DECIMAL(18,6),
ADD COLUMN     "vet_hold_at" TIMESTAMPTZ(6),
ALTER COLUMN "client_id" DROP NOT NULL;

-- AlterTable
-- amount_original is added nullable and backfilled before being made NOT NULL:
-- every existing payment was taken in USD, so what was handed over is exactly
-- the amount already recorded. fx_rate stays null for those, meaning "USD, no
-- conversion involved".
ALTER TABLE "payments" ADD COLUMN     "amount_original" DECIMAL(16,2),
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN     "fx_rate" DECIMAL(18,6),
ALTER COLUMN "client_id" DROP NOT NULL;

UPDATE "payments" SET "amount_original" = "amount" WHERE "amount_original" IS NULL;

ALTER TABLE "payments" ALTER COLUMN "amount_original" SET NOT NULL;

-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" INTEGER,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_attending_vet_id_fkey" FOREIGN KEY ("attending_vet_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the exchange rate so the app has a value on first run. Editable by an
-- Admin from the UI afterwards; this is only the starting point.
INSERT INTO "settings" ("key", "value") VALUES ('fx.usd_lbp', '89500')
ON CONFLICT ("key") DO NOTHING;
