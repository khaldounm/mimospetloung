-- The patient list is ordered by name and filtered by first letter. Without an
-- index this sorts all 1,407 rows on every page load, and the letter filter
-- scans the table.
CREATE INDEX IF NOT EXISTS "idx_patients_name"
  ON "patients" ("name", "patient_id");

-- Serves the letter jump bar: upper(left(name,1)) is what the bar filters on,
-- so it has to be indexed as an expression to be usable.
CREATE INDEX IF NOT EXISTS "idx_patients_name_initial"
  ON "patients" (upper(left("name", 1)));
