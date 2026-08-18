"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { formatTime, toDateTimeLocal } from "@/utils/format";
import { BOOKING_STATUSES, type BookingStatus } from "@/types/enums";
import {
  CLINIC_CLOSE_HOUR,
  CLINIC_OPEN_HOUR,
  DEFAULT_SLOT_MINUTES,
} from "@/constants/booking";
import type {
  BookingDTO,
  BookingTypeOption,
  PatientOption,
  StaffOption,
} from "@/types/entities";

interface Slot {
  start: Date;
  end: Date;
  available: boolean;
}

// Date -> "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  booking?: BookingDTO | null;
  patientOptions: PatientOption[];
  staffOptions: StaffOption[];
  typeOptions: BookingTypeOption[];
  onClose: () => void;
  onSaved: () => void;
}

// datetime-local string -> ISO (with timezone) so the server interprets the
// instant unambiguously regardless of its own timezone.
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function BookingFormDialog({ open, onClose, ...rest }: Props) {
  // Remount the form (via key) each time the dialog opens instead of syncing
  // props into state with an effect. State is initialized directly from props.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <BookingForm
          key={rest.booking?.bookingId ?? "new"}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function BookingForm({
  booking,
  patientOptions,
  staffOptions,
  typeOptions,
  onClose,
  onSaved,
}: FormProps) {
  const editing = Boolean(booking);
  const [patientId, setPatientId] = useState<number | null>(
    booking?.patientId ?? null,
  );
  const [staffId, setStaffId] = useState(
    booking?.staffId ? String(booking.staffId) : "",
  );
  const [typeId, setTypeId] = useState(
    booking?.typeId ? String(booking.typeId) : "",
  );
  const [slotDate, setSlotDate] = useState(
    booking?.startsAt ? booking.startsAt.slice(0, 10) : "",
  );
  const [startsAt, setStartsAt] = useState(toDateTimeLocal(booking?.startsAt));
  const [endsAt, setEndsAt] = useState(
    booking?.endsAt ? toDateTimeLocal(booking.endsAt) : "",
  );
  const [status, setStatus] = useState(booking?.status ?? "Scheduled");
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dayBookings, setDayBookings] = useState<BookingDTO[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  // Captured when the day's bookings load (an impure Date.now() can't run
  // during render), used to mark past slots as unavailable.
  const [now, setNow] = useState(() => Date.now());

  const selectedType = typeOptions.find((t) => String(t.typeId) === typeId);
  const slotMinutes = selectedType?.durationMinutes ?? DEFAULT_SLOT_MINUTES;

  // Load the chosen staff member's bookings for the chosen day so we can mark
  // overlapping slots as taken. Slots are per-staff because the double-booking
  // rule is per-staff.
  useEffect(() => {
    // When either field is empty the `slots` memo returns [] regardless of
    // dayBookings, so there's nothing to fetch and no need to reset state here
    // (which would trigger an extra synchronous render).
    if (!slotDate || !staffId) return;
    let cancelled = false;
    void (async () => {
      setLoadingSlots(true);
      try {
        const dayStart = new Date(`${slotDate}T00:00:00`);
        const dayEnd = new Date(`${slotDate}T23:59:59.999`);
        const params = new URLSearchParams({
          from: dayStart.toISOString(),
          to: dayEnd.toISOString(),
          staffId,
        });
        const data = await apiRequest<{ bookings: BookingDTO[] }>(
          `/api/bookings?${params.toString()}`,
        );
        if (!cancelled) {
          setDayBookings(data.bookings);
          setNow(Date.now());
        }
      } catch {
        if (!cancelled) setDayBookings([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slotDate, staffId]);

  const slots = useMemo<Slot[]>(() => {
    if (!slotDate || !staffId) return [];
    const [y, m, d] = slotDate.split("-").map(Number);
    const busy = dayBookings
      .filter((b) => b.status !== "Cancelled" && b.status !== "No Show")
      .filter((b) => b.bookingId !== booking?.bookingId)
      .map((b) => ({
        s: new Date(b.startsAt).getTime(),
        e: new Date(b.endsAt).getTime(),
      }));
    const out: Slot[] = [];
    for (
      let mins = CLINIC_OPEN_HOUR * 60;
      mins + slotMinutes <= CLINIC_CLOSE_HOUR * 60;
      mins += slotMinutes
    ) {
      const start = new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60);
      const end = new Date(start.getTime() + slotMinutes * 60_000);
      const overlaps = busy.some(
        (r) => start.getTime() < r.e && end.getTime() > r.s,
      );
      out.push({
        start,
        end,
        available: !overlaps && start.getTime() >= now,
      });
    }
    return out;
  }, [slotDate, staffId, dayBookings, slotMinutes, booking?.bookingId, now]);

  function selectSlot(slot: Slot) {
    setStartsAt(toLocalInput(slot.start));
    setEndsAt(toLocalInput(slot.end));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!editing && !patientId) {
      setError("Please select a patient.");
      return;
    }
    if (!startsAt) {
      setError("Please choose a start time.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        staffId: staffId || "",
        typeId: typeId || "",
        startsAt: toIso(startsAt),
        endsAt: toIso(endsAt) ?? "",
        notes,
      };
      if (editing) {
        body.status = status;
        await apiRequest(`/api/bookings/${booking!.bookingId}`, {
          method: "PATCH",
          body,
        });
      } else {
        body.patientId = patientId;
        await apiRequest("/api/bookings", { method: "POST", body });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>{editing ? "Edit booking" : "New booking"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {editing ? (
            <Typography variant="body2" color="text.secondary">
              Patient: <strong>{booking!.patientName}</strong> (
              {booking!.clientName})
            </Typography>
          ) : (
            <Autocomplete
              options={patientOptions}
              getOptionLabel={(o) => o.label}
              value={
                patientOptions.find((o) => o.patientId === patientId) ?? null
              }
              onChange={(_e, v) => setPatientId(v?.patientId ?? null)}
              renderInput={(p) => <TextField {...p} label="Patient" required />}
            />
          )}

          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Staff"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              fullWidth
            >
              <MenuItem value="">Unassigned</MenuItem>
              {staffOptions.map((s) => (
                <MenuItem key={s.userId} value={String(s.userId)}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Type"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              fullWidth
              helperText={
                selectedType
                  ? `${selectedType.durationMinutes} min`
                  : "End time required if no type"
              }
            >
              <MenuItem value="">None</MenuItem>
              {typeOptions.map((t) => (
                <MenuItem key={t.typeId} value={String(t.typeId)}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack spacing={1}>
            <TextField
              label="Date"
              type="date"
              value={slotDate}
              onChange={(e) => setSlotDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            {!staffId ? (
              <Typography variant="body2" color="text.secondary">
                Select a staff member to see available slots.
              </Typography>
            ) : !slotDate ? (
              <Typography variant="body2" color="text.secondary">
                Pick a date to see available slots.
              </Typography>
            ) : loadingSlots ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Loading slots…
                </Typography>
              </Stack>
            ) : (
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", gap: 1 }}
              >
                {slots.map((slot) => {
                  const value = toLocalInput(slot.start);
                  return (
                    <Chip
                      key={value}
                      label={formatTime(slot.start.toISOString())}
                      size="small"
                      clickable={slot.available}
                      disabled={!slot.available}
                      color={startsAt === value ? "primary" : "default"}
                      variant={startsAt === value ? "filled" : "outlined"}
                      onClick={
                        slot.available ? () => selectSlot(slot) : undefined
                      }
                    />
                  );
                })}
              </Stack>
            )}
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Starts at"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
            <TextField
              label="Ends at"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Auto from type if blank"
              fullWidth
            />
          </Stack>

          {editing && (
            <TextField
              select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as BookingStatus)}
              fullWidth
            >
              {BOOKING_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </form>
  );
}
