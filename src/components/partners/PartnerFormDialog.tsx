"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import PayoutPreview from "@/components/ui/PayoutPreview";
import type { PartnerDTO } from "@/types/entities";

interface Props {
  open: boolean;
  partner?: PartnerDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function PartnerFormDialog({ open, onClose, ...rest }: Props) {
  // Remount per record (via key) so state initializes from props at mount.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <PartnerForm
          key={rest.partner?.partnerId ?? "new"}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function PartnerForm({ partner, onClose, onSaved }: FormProps) {
  const editing = Boolean(partner);
  const [name, setName] = useState(partner?.name ?? "");
  const [phone, setPhone] = useState(partner?.phone ?? "");
  const [defaultCostPct, setDefaultCostPct] = useState(
    partner?.defaultCostPct ?? "100",
  );
  const [defaultProfitPct, setDefaultProfitPct] = useState(
    partner?.defaultProfitPct ?? "",
  );
  const [notes, setNotes] = useState(partner?.notes ?? "");
  const [isActive, setIsActive] = useState(partner?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        phone,
        defaultCostPct,
        defaultProfitPct,
        notes,
        isActive,
      };
      if (editing) {
        await apiRequest(`/api/partners/${partner!.partnerId}`, {
          method: "PATCH",
          body,
        });
      } else {
        await apiRequest("/api/partners", { method: "POST", body });
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
      <DialogTitle>{editing ? "Edit partner" : "New partner"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Default cost share"
              type="number"
              value={defaultCostPct}
              onChange={(e) => setDefaultCostPct(e.target.value)}
              slotProps={{
                // Above 100 on purpose: that is how an agreed uplift on cost is
                // entered, so the spinner must not stop at 100.
                htmlInput: { min: 0, max: 999.99, step: "0.01" },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">%</InputAdornment>
                  ),
                },
              }}
              helperText="100 returns their cost. Over 100 adds an uplift"
              fullWidth
            />
            <TextField
              label="Default profit share"
              type="number"
              value={defaultProfitPct}
              onChange={(e) => setDefaultProfitPct(e.target.value)}
              slotProps={{
                htmlInput: { min: 0, max: 100, step: "0.01" },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">%</InputAdornment>
                  ),
                },
              }}
              helperText="Their cut of anything the sale makes over cost"
              fullWidth
            />
          </Stack>
          <PayoutPreview
            costPct={defaultCostPct}
            profitPct={defaultProfitPct}
          />
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          {editing && (
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              }
              label="Active (offered when tagging inventory items)"
            />
          )}
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
