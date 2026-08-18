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
import { RECORD_TYPES, type RecordType } from "@/types/enums";
import type { ServicePickerOption } from "@/types/entities";

interface Props {
  open: boolean;
  patientId: number;
  services: ServicePickerOption[];
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_DETAILS: Record<RecordType, Record<string, string>> = {
  Consultation: {
    chiefComplaint: "",
    assessment: "",
    plan: "",
    medication: "",
  },
  Vaccination: { lotNumber: "", manufacturer: "" },
  Grooming: { coatCondition: "" },
  Treatment: { procedure: "", findings: "", result: "" },
};

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

export default function AddRecordDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <AddRecordForm key={rest.patientId} onClose={onClose} {...rest} />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function AddRecordForm({ patientId, services, onClose, onSaved }: FormProps) {
  const [recordType, setRecordType] = useState<RecordType>("Consultation");
  const [subcategory, setSubcategory] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAt, setPerformedAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [nextDueDate, setNextDueDate] = useState("");
  const [details, setDetails] = useState<Record<string, string>>(() => ({
    ...EMPTY_DETAILS.Consultation,
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const availableServices = services.filter((s) => s.category === recordType);

  function changeType(type: RecordType) {
    setRecordType(type);
    setSubcategory("");
    setTitle("");
    setDetails({ ...EMPTY_DETAILS[type] });
  }

  function changeSubcategory(value: string) {
    setSubcategory(value);
    if (value && value !== "__other__") {
      setTitle(value);
    } else if (value === "__other__") {
      setTitle("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiRequest(`/api/patients/${patientId}/records`, {
        method: "POST",
        body: {
          recordType,
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
      });
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
      <DialogTitle>Add clinical record</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            select
            label="Record type"
            value={recordType}
            onChange={(e) => changeType(e.target.value as RecordType)}
            fullWidth
          >
            {RECORD_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>

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
          {saving ? "Saving..." : "Save record"}
        </Button>
      </DialogActions>
    </form>
  );
}
