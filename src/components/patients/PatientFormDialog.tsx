"use client";

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { PATIENT_SEXES } from "@/types/enums";
import type { PatientDTO } from "@/types/entities";

export interface ClientOption {
  clientId: number;
  label: string;
}

interface Props {
  open: boolean;
  patient?: PatientDTO | null;
  fixedClientId?: number;
  clientOptions?: ClientOption[];
  onClose: () => void;
  onSaved: () => void;
}

export default function PatientFormDialog({ open, onClose, ...rest }: Props) {
  // Remount the form (via key) each time the dialog opens instead of syncing
  // props into state with an effect. State is initialized directly from props.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <PatientForm
          key={rest.patient?.patientId ?? "new"}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function PatientForm({
  patient,
  fixedClientId,
  clientOptions = [],
  onClose,
  onSaved,
}: FormProps) {
  const editing = Boolean(patient);
  const [clientId, setClientId] = useState<number | null>(
    patient?.clientId ?? fixedClientId ?? null,
  );
  const [name, setName] = useState(patient?.name ?? "");
  const [species, setSpecies] = useState(patient?.species ?? "");
  const [breed, setBreed] = useState(patient?.breed ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(patient?.dateOfBirth ?? "");
  const [sex, setSex] = useState(patient?.sex ?? "");
  const [isNeutered, setIsNeutered] = useState(patient?.isNeutered ?? false);
  const [microchipId, setMicrochipId] = useState(patient?.microchipId ?? "");
  const [notes, setNotes] = useState(patient?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!editing && !clientId) {
      setError("Please select an owner.");
      return;
    }

    setSaving(true);
    try {
      const common = {
        name,
        species,
        breed,
        dateOfBirth,
        sex,
        isNeutered,
        microchipId,
        notes,
      };
      if (editing) {
        await apiRequest(`/api/patients/${patient!.patientId}`, {
          method: "PATCH",
          body: common,
        });
      } else {
        await apiRequest("/api/patients", {
          method: "POST",
          body: { ...common, clientId },
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const showPicker = !editing && !fixedClientId;

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>{editing ? "Edit patient" : "New patient"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {showPicker && (
            <Autocomplete
              options={clientOptions}
              getOptionLabel={(o) => o.label}
              value={clientOptions.find((o) => o.clientId === clientId) ?? null}
              onChange={(_e, v) => setClientId(v?.clientId ?? null)}
              renderInput={(p) => <TextField {...p} label="Owner" required />}
            />
          )}

          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Species"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              fullWidth
            />
            <TextField
              label="Breed"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Date of birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              select
              label="Sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              fullWidth
            >
              <MenuItem value="">Unspecified</MenuItem>
              {PATIENT_SEXES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Microchip ID"
            value={microchipId}
            onChange={(e) => setMicrochipId(e.target.value)}
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={isNeutered}
                onChange={(e) => setIsNeutered(e.target.checked)}
              />
            }
            label="Neutered / spayed"
          />
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
