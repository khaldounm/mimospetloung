"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import type { ClinicalRecordDTO, ServicePickerOption } from "@/types/entities";
import type { RecordType } from "@/types/enums";

interface Props {
  open: boolean;
  record: ClinicalRecordDTO;
  patientId: number;
  services: ServicePickerOption[];
  onClose: () => void;
  onSaved: () => void;
}

const DETAIL_LABELS: Record<string, string> = {
  chiefComplaint: "Chief complaint",
  assessment: "Assessment / diagnosis",
  plan: "Treatment plan",
  medication: "Medication",
  lotNumber: "Lot number",
  manufacturer: "Manufacturer",
  coatCondition: "Coat condition",
  procedure: "Procedure",
  findings: "Findings",
  result: "Result / outcome",
};

const SUBCATEGORY_LABEL: Record<RecordType, string> = {
  Consultation: "Service type",
  Vaccination: "Vaccine",
  Grooming: "Service",
  Treatment: "Service type",
};

export default function EditRecordDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <EditRecordForm
          key={rest.record.recordId}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function EditRecordForm({
  record,
  patientId,
  services,
  onClose,
  onSaved,
}: FormProps) {
  const [subcategory, setSubcategory] = useState(record.subcategory ?? "");
  const [title, setTitle] = useState(record.title);
  const [notes, setNotes] = useState(record.notes ?? "");
  const [performedAt, setPerformedAt] = useState(record.performedAt);
  const [nextDueDate, setNextDueDate] = useState(record.nextDueDate ?? "");
  const [details, setDetails] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(record.details ?? {}).map(([k, v]) => [
        k,
        String(v ?? ""),
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recordType = record.recordType;
  const availableServices = services.filter((s) => s.category === recordType);

  function changeSubcategory(value: string) {
    setSubcategory(value);
    if (value && value !== "__other__") setTitle(value);
    else if (value === "__other__") setTitle("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiRequest(
        `/api/patients/${patientId}/records/${record.recordId}`,
        {
          method: "PATCH",
          body: {
            subcategory:
              subcategory && subcategory !== "__other__"
                ? subcategory
                : undefined,
            title,
            notes,
            performedAt,
            nextDueDate,
            details,
          },
        },
      );
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
      <DialogTitle>Edit {recordType.toLowerCase()} record</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {availableServices.length > 0 && (
            <TextField
              select
              label={SUBCATEGORY_LABEL[recordType]}
              value={subcategory}
              onChange={(e) => changeSubcategory(e.target.value)}
              fullWidth
            >
              {availableServices.map((s) => (
                <MenuItem key={s.serviceId} value={s.name}>
                  {s.name}
                </MenuItem>
              ))}
              <MenuItem value="__other__">Other / custom</MenuItem>
            </TextField>
          )}

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="Performed at"
              type="date"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="Next due date"
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>

          {Object.keys(details).map((key) => (
            <TextField
              key={key}
              label={DETAIL_LABELS[key] ?? key}
              value={details[key]}
              onChange={(e) =>
                setDetails((d) => ({ ...d, [key]: e.target.value }))
              }
              fullWidth
            />
          ))}

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
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </DialogActions>
    </form>
  );
}
