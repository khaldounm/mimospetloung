-- Drop the one-per-patient constraint so each clinical record gets its own reminder row.
DROP INDEX IF EXISTS uq_reminders_open;
