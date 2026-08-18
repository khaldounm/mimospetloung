-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review_note" TEXT;

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review_note" TEXT;

-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review_note" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review_note" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review_note" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review_note" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review_note" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review_note" TEXT;
