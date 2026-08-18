-- ============================================================
-- RECALL REMINDERS (vaccination / grooming follow-ups)
-- Materialised recall list, one Open row per (patient, record_type), sourced
-- from the latest due-bearing clinical record. The Notifications tabs read this
-- small, indexed table instead of scanning all clinical history.
--
-- "due / upcoming / overdue" is derived from due_date at read time (never
-- persisted), so the list cannot go stale and needs no cron. status carries only
-- the lifecycle that cannot be derived from the source record. updated_at is
-- maintained by the shared trigger.
-- ============================================================
CREATE TABLE reminders (
    reminder_id      SERIAL PRIMARY KEY,
    patient_id       INT NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    source_record_id INT REFERENCES clinical_records(record_id) ON DELETE SET NULL,
    record_type      VARCHAR(20) NOT NULL CHECK (record_type IN ('Vaccination', 'Grooming')),
    title            VARCHAR(255) NOT NULL,
    due_date         DATE NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'Open'
                         CHECK (status IN ('Open', 'Done', 'Dismissed')),
    snoozed_until    DATE,                              -- hide an Open recall until this date
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one active recall per patient + type. Lets the record-create path
-- upsert safely and guarantees the tabs never show duplicates.
CREATE UNIQUE INDEX uq_reminders_open
    ON reminders (patient_id, record_type) WHERE status = 'Open';

-- Tab query: open recalls of one type due within the window, oldest first.
CREATE INDEX idx_reminders_due
    ON reminders (record_type, due_date) WHERE status = 'Open';

CREATE TRIGGER trg_reminders_updated BEFORE UPDATE ON reminders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Backfill: one Open reminder per (patient, record_type) = that patient's most
-- recent due-bearing record of the type. Mirrors the previous derived query
-- exactly (latest performed_at wins; archived patients/clients excluded).
INSERT INTO reminders (patient_id, source_record_id, record_type, title, due_date, status)
SELECT DISTINCT ON (cr.patient_id, cr.record_type)
    cr.patient_id, cr.record_id, cr.record_type, cr.title, cr.next_due_date, 'Open'
FROM clinical_records cr
JOIN patients p ON p.patient_id = cr.patient_id AND p.deleted_at IS NULL
JOIN clients  c ON c.client_id  = p.client_id  AND c.deleted_at IS NULL
WHERE cr.record_type IN ('Vaccination', 'Grooming')
  AND cr.next_due_date IS NOT NULL
ORDER BY cr.patient_id, cr.record_type, cr.performed_at DESC, cr.record_id DESC;
