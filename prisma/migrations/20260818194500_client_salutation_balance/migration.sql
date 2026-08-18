-- The client's title is stored rather than stripped, and the account carries a
-- running balance mirroring the old system's WSAccount (positive = owes us).
ALTER TABLE "clients" ADD COLUMN "salutation" VARCHAR(20);
ALTER TABLE "clients" ADD COLUMN "account_balance" DECIMAL(12,2) NOT NULL DEFAULT 0;
