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
import { PAYMENT_METHODS } from "@/types/enums";
import type { InvoiceDTO } from "@/types/entities";

interface Props {
  open: boolean;
  invoiceId: number;
  balance: string;
  onClose: () => void;
  onSaved: (invoice: InvoiceDTO) => void;
}

export default function PaymentDialog({ open, onClose, ...rest }: Props) {
  // Remount the form (via key) each time the dialog opens instead of syncing
  // props into state with an effect. State is initialized directly from props.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      {open && <PaymentForm key={rest.invoiceId} onClose={onClose} {...rest} />}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function PaymentForm({ invoiceId, balance, onClose, onSaved }: FormProps) {
  // Default to settling the full outstanding balance.
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = await apiRequest<{ invoice: InvoiceDTO }>(
        `/api/invoices/${invoiceId}/payments`,
        {
          method: "POST",
          body: { amount, method, reference, paidAt, notes },
        },
      );
      onSaved(data.invoice);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>Record payment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            helperText={`Outstanding balance: ${balance}`}
            required
            fullWidth
          />
          <TextField
            select
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            fullWidth
          >
            <MenuItem value="">Unspecified</MenuItem>
            {PAYMENT_METHODS.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            fullWidth
          />
          <TextField
            label="Paid on"
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Defaults to today if left blank"
            fullWidth
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
          {saving ? "Saving…" : "Record"}
        </Button>
      </DialogActions>
    </form>
  );
}
