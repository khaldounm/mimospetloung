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
import type { InvoiceDTO } from "@/types/entities";

export interface ClientOption {
  clientId: number;
  label: string;
}

interface Props {
  open: boolean;
  clientOptions: ClientOption[];
  // When provided, the dialog edits this draft instead of creating a new one.
  invoice?: InvoiceDTO | null;
  onClose: () => void;
  onSaved: (invoice: InvoiceDTO) => void;
}

export default function InvoiceFormDialog({ open, onClose, ...rest }: Props) {
  // Remount the form (via key) each time the dialog opens instead of syncing
  // props into state with an effect. State is initialized directly from props.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <InvoiceForm
          key={rest.invoice?.invoiceId ?? "new"}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function InvoiceForm({ clientOptions, invoice, onClose, onSaved }: FormProps) {
  const editing = Boolean(invoice);
  const [clientId, setClientId] = useState(
    invoice ? String(invoice.clientId) : "",
  );
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? "");
  const [discountPct, setDiscountPct] = useState(invoice?.discountPct ?? "0");
  const [taxPct, setTaxPct] = useState(invoice?.taxPct ?? "0");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = { clientId, dueDate, discountPct, taxPct, notes };
      const data = editing
        ? await apiRequest<{ invoice: InvoiceDTO }>(
            `/api/invoices/${invoice!.invoiceId}`,
            { method: "PATCH", body },
          )
        : await apiRequest<{ invoice: InvoiceDTO }>("/api/invoices", {
            method: "POST",
            body,
          });
      onSaved(data.invoice);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label="Client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            fullWidth
          >
            {clientOptions.map((c) => (
              <MenuItem key={c.clientId} value={String(c.clientId)}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Discount %"
              type="number"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
              slotProps={{ htmlInput: { min: 0, max: 100, step: "0.01" } }}
              fullWidth
            />
            <TextField
              label="Tax %"
              type="number"
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
              slotProps={{ htmlInput: { min: 0, max: 100, step: "0.01" } }}
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
          {saving ? "Saving…" : editing ? "Save" : "Create draft"}
        </Button>
      </DialogActions>
    </form>
  );
}
