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
  Typography,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { PARTNER_PAYOUT_METHODS } from "@/constants/partner";
import { formatMoney } from "@/utils/format";

interface Props {
  open: boolean;
  partnerId: number;
  partnerName: string;
  balance: string;
  onClose: () => void;
  onSaved: () => void;
}

// Today as "YYYY-MM-DD" in local time, for the date input default.
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PartnerPayoutFormDialog({
  open,
  onClose,
  ...rest
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && <PayoutForm key={rest.partnerId} onClose={onClose} {...rest} />}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function PayoutForm({
  partnerId,
  partnerName,
  balance,
  onClose,
  onSaved,
}: FormProps) {
  // Prefill the amount with what is currently owed, if positive.
  const [amount, setAmount] = useState(Number(balance) > 0 ? balance : "");
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiRequest(`/api/partners/${partnerId}/payouts`, {
        method: "POST",
        body: { amount, paidOn, method, reference, notes },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>Record payout to {partnerName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Currently owed: {formatMoney(balance)}
          </Typography>
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
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              fullWidth
            >
              <MenuItem value="">Unspecified</MenuItem>
              {PARTNER_PAYOUT_METHODS.map((m) => (
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
          {saving ? "Saving…" : "Record payout"}
        </Button>
      </DialogActions>
    </form>
  );
}
