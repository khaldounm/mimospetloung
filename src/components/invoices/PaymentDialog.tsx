"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { PAYMENT_METHODS } from "@/types/enums";
import { SECONDARY_CURRENCY } from "@/constants/clinic";
import {
  formatMoney,
  formatSecondaryMoney,
  roundLbpCash,
} from "@/utils/format";
import type { InvoiceDTO } from "@/types/entities";

interface Props {
  open: boolean;
  invoiceId: number;
  balance: string;
  // LBP per 1 USD, from the clinic settings.
  fxRate: number;
  onClose: () => void;
  onSaved: (invoice: InvoiceDTO) => void;
}

export default function PaymentDialog({ open, onClose, ...rest }: Props) {
  // Remount the form (via key) each time the dialog opens instead of syncing
  // props into state with an effect. State is initialized directly from props.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && <PaymentForm key={rest.invoiceId} onClose={onClose} {...rest} />}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
      <Typography
        color="text.secondary"
        sx={{ fontWeight: strong ? 600 : 400 }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontWeight: strong ? 600 : 400 }}>{value}</Typography>
    </Stack>
  );
}

function PaymentForm({
  invoiceId,
  balance,
  fxRate,
  onClose,
  onSaved,
}: FormProps) {
  const due = Number(balance);
  // Cash actually handed over, per currency. Both can be filled: a customer
  // routinely pays part in dollars and the rest in lira.
  const [usdCash, setUsdCash] = useState(balance);
  const [lbpCash, setLbpCash] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const usd = Number(usdCash) || 0;
  const lbp = Number(lbpCash) || 0;
  const tendered = usd + lbp / fxRate;

  // What actually settles the invoice. Anything over the balance is change,
  // and anything under it is a partial payment, which is allowed.
  const applied = Math.min(tendered, due);
  const change = Math.max(0, tendered - due);
  const changeLbp = roundLbpCash(change * fxRate);
  const exactChangeLbp = Math.round(change * fxRate);

  // Dollars are applied first and the lira leg covers the rest, so change comes
  // out of the lira, which is how it is given back at the counter.
  const appliedUsd = Math.min(usd, applied);
  const appliedLbpUsd = applied - appliedUsd;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (applied <= 0) {
      setError("Enter how much was handed over.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<{ invoice: InvoiceDTO }>(
        `/api/invoices/${invoiceId}/payments`,
        {
          method: "POST",
          body: {
            // Each leg is what was APPLIED in that currency, not the cash
            // handed over: change never reaches the ledger.
            tenders: [
              { currency: "USD", amount: appliedUsd.toFixed(2) },
              {
                currency: "LBP",
                amount: Math.round(appliedLbpUsd * fxRate).toString(),
              },
            ],
            method,
            reference,
            paidAt,
            notes,
          },
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
      <DialogTitle>Take payment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack spacing={0.5}>
            <Line label="Balance due" value={formatMoney(due)} strong />
            <Line label="" value={formatSecondaryMoney(due, fxRate)} />
          </Stack>

          <Divider />

          <Typography variant="subtitle2" color="text.secondary">
            Cash received
          </Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="US dollars"
              type="number"
              value={usdCash}
              onChange={(e) => setUsdCash(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              autoFocus
              fullWidth
            />
            <TextField
              label={SECONDARY_CURRENCY.code}
              type="number"
              value={lbpCash}
              onChange={(e) => setLbpCash(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: "1000" } }}
              helperText={`at ${fxRate.toLocaleString("en-US")} / $1`}
              fullWidth
            />
          </Stack>

          <Stack spacing={0.5}>
            <Line label="Total handed over" value={formatMoney(tendered)} />
            <Line
              label="Applied to invoice"
              value={formatMoney(applied)}
              strong
            />
            {applied < due && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Part payment. {formatMoney(due - applied)} will still be
                outstanding.
              </Alert>
            )}
            {change > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Line label="Change due" value={formatMoney(change)} strong />
                <Line
                  label={`Give back in ${SECONDARY_CURRENCY.code}`}
                  value={`${SECONDARY_CURRENCY.symbol} ${changeLbp.toLocaleString("en-US")}`}
                  strong
                />
                {changeLbp !== exactChangeLbp && (
                  <Typography variant="caption" color="text.secondary">
                    Exactly {SECONDARY_CURRENCY.symbol}{" "}
                    {exactChangeLbp.toLocaleString("en-US")}, rounded to the
                    nearest note.
                  </Typography>
                )}
              </>
            )}
          </Stack>

          <Divider />

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
