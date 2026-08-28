-- The Access expense ledger (ExDetails, 488 rows) becomes running costs, so
-- running_costs needs the same legacy key every other imported table carries.
--
-- Without it a re-import has no way to recognise a row it wrote last time and
-- would duplicate all 488 on every run. With it, the loader upserts, and a cost
-- someone typed into the app has a NULL legacy_id and is never touched by the
-- import at all. That split is also what legacy:reset keys on: it clears the
-- imported rows and leaves the hand-entered ones alone.
--
-- Nullable, so the unique index lands on an all-NULL column on any existing
-- database and cannot collide.

ALTER TABLE "running_costs" ADD COLUMN "legacy_id" INTEGER;

CREATE UNIQUE INDEX "running_costs_legacy_id_key" ON "running_costs"("legacy_id");
