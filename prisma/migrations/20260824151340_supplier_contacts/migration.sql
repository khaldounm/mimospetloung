/*
  Warnings:

  - You are about to drop the column `contact_person` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `suppliers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN "contact_person",
DROP COLUMN "email",
DROP COLUMN "phone";

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "contact_id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" VARCHAR(60),
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone" VARCHAR(40),
    "email" VARCHAR(160),
    "notes" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("contact_id")
);

-- CreateIndex
CREATE INDEX "idx_supplier_contacts_supplier" ON "supplier_contacts"("supplier_id");

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A contact with neither a phone nor an email is not a contact. Enforced here
-- rather than in zod alone so an empty repeater row can never reach the table.
ALTER TABLE "supplier_contacts"
    ADD CONSTRAINT "supplier_contacts_reachable"
    CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);

-- At most one primary per supplier. Partial so the many non-primary rows are
-- unconstrained; the API promotes the first contact when a save flags none.
CREATE UNIQUE INDEX "idx_supplier_contacts_primary"
    ON "supplier_contacts" ("supplier_id") WHERE "is_primary";

CREATE TRIGGER trg_supplier_contacts_updated BEFORE UPDATE ON supplier_contacts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
