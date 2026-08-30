-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "daily_minimum" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "partner_attendance" (
    "attendance_id" SERIAL NOT NULL,
    "partner_id" INTEGER NOT NULL,
    "on_date" DATE NOT NULL,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_attendance_pkey" PRIMARY KEY ("attendance_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_partner_attendance_day" ON "partner_attendance"("partner_id", "on_date");

-- AddForeignKey
ALTER TABLE "partner_attendance" ADD CONSTRAINT "partner_attendance_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("partner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_attendance" ADD CONSTRAINT "partner_attendance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A day can carry at most ONE live guarantee top-up. Settling is money, and a
-- double click or two people settling the same month at once would otherwise
-- pay the minimum twice. Partial, so a reversed row does not block re-settling
-- the day after a correction, and not expressible in Prisma.
CREATE UNIQUE INDEX "uq_partner_accruals_guarantee_day"
  ON "partner_accruals" ("partner_id", "earned_on")
  WHERE "source" = 'guarantee' AND "reversed_at" IS NULL;
