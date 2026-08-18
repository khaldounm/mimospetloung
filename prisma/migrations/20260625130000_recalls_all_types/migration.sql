-- Expand the reminders.record_type CHECK to include Consultation and Treatment
-- so clinical records of those types can also materialise recall reminders.
ALTER TABLE reminders
  DROP CONSTRAINT IF EXISTS reminders_record_type_check;

ALTER TABLE reminders
  ADD CONSTRAINT reminders_record_type_check
  CHECK (record_type IN ('Consultation', 'Vaccination', 'Grooming', 'Treatment'));
