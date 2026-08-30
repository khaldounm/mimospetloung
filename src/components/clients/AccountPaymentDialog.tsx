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
  todayForDateInput,
} from "@/utils/format";
import { printAccountReceipt } from "@/utils/print-receipt";

interface Props {
  open: boolean;
  clientId: number;
  clientName: string;
  // What the client owes right now. Always positive here: the button that opens
  // this dialog is hidden unless there is something to pay.
  balance: string;
  // LBP per 1 USD, from the clinic settings.
  fxRate: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function AccountPaymentDialog({
  open,
  onClose,
  ...rest
}: Props) {
  // Remount the form each time the dialog opens rather than syncing props into
  // state, the same way the invoice payment dialog does it.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <AccountPaymentForm key={rest.clientId} onClose={onClose} {...rest} />
      )}
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

function AccountPaymentForm({
  clientId,
  clientName,
  balance,
  fxRate,
  onClose,
  onSaved,
}: FormProps) {
  const owed = Number(balance);
  // Not prefilled with the whole debt: someone paying off an old balance is
  // usually paying part of it, and a prefilled figure is one the counter has to
  // clear before typing the real one.
  const [usdCash, setUsdCash] = useState("");
  const [lbpCash, setLbpCash] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(todayForDateInput());
  // null means "follow the cash": the box shows what the tender covers and
  // keeps up as the counter types. Typing pins a figure instead, which is how a
  // customer pays only part of what they owe out of a bigger note.
  const [settleRaw, setSettleRaw] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const usd = Number(usdCash) || 0;
  const lbp = Number(lbpCash) || 0;
  const tendered = usd + lbp / fxRate;

  // How much of the cash actually comes off the account. It is NOT simply
  // everything handed over: a customer settling an old debt hands over a
  // hundred, says to put twenty against it, and takes eighty back. Defaults to
  // as much as the cash covers, capped at what is owed, and is editable.
  const autoSettle = Math.min(tendered, owed);
  const applied =
    settleRaw === null
      ? autoSettle
      : Math.min(Number(settleRaw) || 0, tendered, owed);
  const settleValue =
    settleRaw ?? (autoSettle > 0 ? autoSettle.toFixed(2) : "");

  // Whatever was handed over and not put against the account goes back as
  // change, in lira, which is how it leaves the drawer.
  const change = Math.max(0, tendered - applied);
  const changeLbp = roundLbpCash(change * fxRate);
  const exactChangeLbp = Math.round(change * fxRate);

  // Dollars first, lira covers the rest, so change comes out of the lira.
  const appliedUsd = Math.min(usd, applied);
  const appliedLbpUsd = applied - appliedUsd;
  const appliedLbp = Math.round(appliedLbpUsd * fxRate);
  const remaining = owed - applied;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (applied <= 0) {
      setError("Enter how much was handed over.");
      return;
    }
    setSaving(true);
    try {
      // Each leg is what was APPLIED in that currency, not the cash handed
      // over: change never reaches the ledger.
      const tenders = [
        { currency: "USD", amount: appliedUsd.toFixed(2) },
        { currency: "LBP", amount: appliedLbp.toString() },
      ];
      const result = await apiRequest<{
        amount: string;
        balanceBefore: string;
        balanceAfter: string;
      }>(`/api/clients/${clientId}/payments`, {
        method: "POST",
        body: { tenders, method, reference, paidAt, notes },
      });

      // The slip is the point of the whole exercise: without an invoice this is
      // the only thing the customer walks away with saying what they paid and
      // what is left. Printed from the server's figures, not the form's.
      printAccountReceipt({
        clientName,
        amount: result.amount,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        method: method || null,
        reference: reference || null,
        tenders: [
          ...(appliedUsd > 0
            ? [{ currency: "USD", amountOriginal: appliedUsd.toFixed(2) }]
            : []),
          ...(appliedLbp > 0
            ? [{ currency: "LBP", amountOriginal: appliedLbp.toString() }]
            : []),
        ],
        fxRate: appliedLbp > 0 ? fxRate : null,
      });

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>Payment on account</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack spacing={0.5}>
            <Line label="Owed by" value={clientName} />
            <Line label="Account balance" value={formatMoney(owed)} strong />
            <Line label="" value={formatSecondaryMoney(owed, fxRate)} />
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
          </Stack>

          <TextField
            label="Put against the account"
            type="number"
            value={settleValue}
            onChange={(e) => setSettleRaw(e.target.value)}
            slotProps={{
              htmlInput: { min: 0, max: owed, step: "0.01" },
              // The figure follows the cash rather than being typed, so the
              // label has to be told to get out of its way.
              inputLabel: { shrink: true },
            }}
            helperText={
              tendered <= 0
                ? "Enter the cash received above."
                : `Up to ${formatMoney(Math.min(tendered, owed))}, the rest comes back as change`
            }
            fullWidth
          />

          <Stack spacing={0.5}>
            <Line
              label={remaining > 0 ? "Balance remaining" : "Account settled"}
              value={formatMoney(remaining)}
              strong
            />
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
            helperText="Change only if this money came in on another day"
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
          {saving ? "Saving…" : "Record and print"}
        </Button>
      </DialogActions>
    </form>
  );
}
