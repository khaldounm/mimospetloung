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
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import type { SupplierDTO } from "@/types/entities";

interface Props {
  open: boolean;
  supplier?: SupplierDTO | null;
  /** Prefills the name when opened from a "create this supplier" shortcut. */
  initialName?: string;
  onClose: () => void;
  /** Receives the saved record so callers can select it straight away. */
  onSaved: (supplier: SupplierDTO) => void;
}

export default function SupplierFormDialog({ open, onClose, ...rest }: Props) {
  // Remount per record (via key) so state initializes from props at mount.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <SupplierForm
          key={rest.supplier?.supplierId ?? "new"}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function SupplierForm({ supplier, initialName, onClose, onSaved }: FormProps) {
  const editing = Boolean(supplier);
  const [name, setName] = useState(supplier?.name ?? initialName ?? "");
  const [contactPerson, setContactPerson] = useState(
    supplier?.contactPerson ?? "",
  );
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true);
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
      const body = { name, contactPerson, phone, email, notes, isActive };
      const res = editing
        ? await apiRequest<{ supplier: SupplierDTO }>(
            `/api/suppliers/${supplier!.supplierId}`,
            { method: "PATCH", body },
          )
        : await apiRequest<{ supplier: SupplierDTO }>("/api/suppliers", {
            method: "POST",
            body,
          });
      onSaved(res.supplier);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Company name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Contact person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
