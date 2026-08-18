-- Drop whatever CHECK constraint exists on clinical_records.record_type first,
-- so the UPDATE below is not blocked by the old 3-type constraint.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT c.conname INTO cname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'clinical_records'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%record_type%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE clinical_records DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

-- Rename existing Diagnosis records to Consultation.
UPDATE clinical_records SET record_type = 'Consultation' WHERE record_type = 'Diagnosis';

-- Add the new 4-type CHECK.
ALTER TABLE clinical_records
  ADD CONSTRAINT clinical_records_record_type_check
  CHECK (record_type IN ('Consultation', 'Vaccination', 'Grooming', 'Treatment'));

-- Add subcategory column.
ALTER TABLE clinical_records ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);

-- Backfill subcategory for Vaccination from details->>'vaccineName'.
UPDATE clinical_records
  SET subcategory = details->>'vaccineName'
  WHERE record_type = 'Vaccination'
    AND details->>'vaccineName' IS NOT NULL
    AND details->>'vaccineName' <> '';

-- Backfill subcategory for Grooming from details->>'services' (cap at 100 chars).
UPDATE clinical_records
  SET subcategory = SUBSTRING(details->>'services', 1, 100)
  WHERE record_type = 'Grooming'
    AND details->>'services' IS NOT NULL
    AND details->>'services' <> '';
