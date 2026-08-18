// Clinic operating window (local time) and default slot length used to build the
// available-slots grid in the booking dialog. The DB still enforces overlap rules;
// these values only shape the suggested slots shown to staff.
export const CLINIC_OPEN_HOUR = 9; // first slot starts at 09:00
export const CLINIC_CLOSE_HOUR = 17; // last slot must end by 17:00
export const DEFAULT_SLOT_MINUTES = 30;
