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
  Stack,
  TextField,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import {
  RUNNING_COST_CATEGORIES,
  RUNNING_COST_ITEM_SUGGESTIONS,
} from "@/constants/running-cost";
import type { RunningCostDTO } from "@/types/entities";

interface Props {
  open: boolean;
  cost?: RunningCostDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

// Today as "YYYY-MM-DD" in local time, for the date input default.
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function RunningCostFormDialog({
  open,
  onClose,
  ...rest
}: Props) {
  // Remount the form (via key) each time the dialog opens instead of syncing
  // props into state with an effect. State is initialized directly from props.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <RunningCostForm
          key={rest.cost?.costId ?? "new"}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function RunningCostForm({ cost, onClose, onSaved }: FormProps) {
  const editing = Boolean(cost);
  const [category, setCategory] = useState(cost?.category ?? "");
  const [description, setDescription] = useState(cost?.description ?? "");
  const [amount, setAmount] = useState(cost?.amount ?? "");
  const [incurredOn, setIncurredOn] = useState(cost?.incurredOn ?? today());
  const [notes, setNotes] = useState(cost?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Item suggestions narrow to the chosen category, but free text is allowed.
  const itemOptions = RUNNING_COST_ITEM_SUGGESTIONS[category] ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!category.trim()) {
      setError("Please choose or enter a category.");
      return;
    }
    if (!description.trim()) {
      setError("Please choose or enter an item.");
      return;
    }
    setSaving(true);
    try {
      const body = { category, description, amount, incurredOn, notes };
      if (editing) {
        await apiRequest(`/api/running-costs/${cost!.costId}`, {
          method: "PATCH",
          body,
        });
      } else {
        await apiRequest("/api/running-costs", { method: "POST", body });
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
      <DialogTitle>{editing ? "Edit cost" : "New cost"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Autocomplete
            freeSolo
            options={itemOptions}
            // Control BOTH value and inputValue. With only inputValue set, MUI
            // syncs the input from the uncontrolled (null) value on mount and
            // fires a "reset" onInputChange with "", wiping the prefilled text
            // when editing. Binding value stops that reset.
            value={description}
            onChange={(_e, v) => setDescription(v ?? "")}
            inputValue={description}
            onInputChange={(_e, v) => setDescription(v)}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Item"
                required
                helperText="e.g. Electricity, Gloves, Betadine. Type a new one if needed."
              />
            )}
          />

          <Autocomplete
            freeSolo
            options={RUNNING_COST_CATEGORIES as readonly string[] as string[]}
            // Control value too, for the same reason as the Item field above
            // (otherwise the mount "reset" blanks the prefilled category on edit).
            value={category}
            onChange={(_e, v) => setCategory(v ?? "")}
            inputValue={category}
            onInputChange={(_e, v) => setCategory(v)}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Category"
                required
                helperText="Pick a category or type a new one"
              />
            )}
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              required
              fullWidth
            />
            <TextField
              label="Date"
              type="date"
              value={incurredOn}
              onChange={(e) => setIncurredOn(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
          </Stack>

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
