"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
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
import type { InvoiceDTO } from "@/types/entities";

interface Props {
  open: boolean;
  invoiceId: number;
  balance: string;
  // The client's WHOLE account balance, which already includes this invoice.
  // Null for a walk-in, who has no account. See accountDue below.
  accountBalance: string | null;
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
  accountBalance,
  fxRate,
  onClose,
  onSaved,
}: FormProps) {
  const due = Number(balance);
  // A return whose credit has not been handed back yet has a NEGATIVE balance:
  // the shop owes the customer. Everything below works on the magnitude and
  // reads `refunding` for the wording, which keeps one set of arithmetic for
  // both directions. The tenders posted stay positive either way; the server
  // takes the direction from the invoice, so the counter cannot hand back money
  // on a document that was owed to the shop.
  const refunding = due < 0;
  const owed = Math.abs(due);
  // Cash actually handed over, per currency. Both can be filled: a customer
  // routinely pays part in dollars and the rest in lira.
  const [usdCash, setUsdCash] = useState(owed.toFixed(2));
  const [lbpCash, setLbpCash] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  // Payment is being taken now, so today is the answer nearly every time.
  const [paidAt, setPaidAt] = useState(todayForDateInput());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // What the client owed BEFORE this visit. Issuing an invoice already added
  // its total to the account balance, so the account still contains the invoice
  // on screen: subtracting it leaves the older debt, which is the only part the
  // counter can settle on top of what is being paid here.
  const accountDue =
    accountBalance != null && !refunding
      ? Math.max(0, Number(accountBalance) - due)
      : 0;

  // Nothing older is outstanding, so the whole idea stays off the screen and
  // the dialog reads exactly as it did before.
  const canSettleAccount = accountDue > 0;
  const [settleOn, setSettleOn] = useState(canSettleAccount);
  // null means "follow the cash": the box shows whatever is left over after the
  // invoice, capped at the debt, and keeps up as the counter types. Typing in
  // it pins a figure instead, which is how a customer settles only part of what
  // they owe.
  const [settleRaw, setSettleRaw] = useState<string | null>(null);

  const usd = Number(usdCash) || 0;
  const lbp = Number(lbpCash) || 0;
  const tendered = usd + lbp / fxRate;

  // What actually settles the invoice. Anything under the balance is a partial
  // payment, which is allowed; anything over it is free to go against older
  // debt, and whatever is not taken for that is change.
  //
  // There is no change on a refund: the shop chooses which notes to hand back,
  // so anything beyond the credit is not change, it is an overpayment the
  // server rejects.
  const applied = Math.min(tendered, owed);
  const spare = refunding ? 0 : Math.max(0, tendered - applied);
  const autoSettle = Math.min(spare, accountDue);
  const toAccount = settleOn
    ? Math.min(
        settleRaw === null ? autoSettle : Number(settleRaw) || 0,
        spare,
        accountDue,
      )
    : 0;
  const settleValue =
    settleRaw ?? (autoSettle > 0 ? autoSettle.toFixed(2) : "");

  const change = refunding ? 0 : Math.max(0, tendered - applied - toAccount);
  const changeLbp = roundLbpCash(change * fxRate);
  const exactChangeLbp = Math.round(change * fxRate);

  // Dollars are applied first and the lira leg covers the rest, so change comes
  // out of the lira, which is how it is given back at the counter. The account
  // legs take what the invoice left of each currency, same order.
  const appliedUsd = Math.min(usd, applied);
  const appliedLbpUsd = applied - appliedUsd;
  const accountUsd = Math.min(usd - appliedUsd, toAccount);
  const accountLbpUsd = toAccount - accountUsd;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (applied <= 0) {
      setError(
        refunding
          ? "Enter how much is being handed back."
          : "Enter how much was handed over.",
      );
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
            // Cash from the same handover going against older debt. The server
            // checks it against what is outstanding beyond this invoice.
            accountTenders: [
              { currency: "USD", amount: accountUsd.toFixed(2) },
              {
                currency: "LBP",
                amount: Math.round(accountLbpUsd * fxRate).toString(),
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
      <DialogTitle>
        {refunding ? "Refund this return" : "Take payment"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack spacing={0.5}>
            <Line
              label={refunding ? "To hand back" : "Balance due"}
              value={formatMoney(owed)}
              strong
            />
            <Line label="" value={formatSecondaryMoney(owed, fxRate)} />
            {canSettleAccount && (
              <Line
                label="Owed from before this invoice"
                value={formatMoney(accountDue)}
              />
            )}
          </Stack>

          <Divider />

          <Typography variant="subtitle2" color="text.secondary">
            {refunding ? "Cash given back" : "Cash received"}
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
              label={refunding ? "Refunded" : "Applied to invoice"}
              value={formatMoney(applied)}
              strong
            />
            {applied < owed && (
              <Alert severity="info" sx={{ mt: 1 }}>
                {refunding
                  ? `Part refund. ${formatMoney(owed - applied)} will still be owed back.`
                  : `Part payment. ${formatMoney(owed - applied)} will still be outstanding.`}
              </Alert>
            )}
            {canSettleAccount && (
              <>
                <Divider sx={{ my: 1 }} />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settleOn}
                      onChange={(e) => setSettleOn(e.target.checked)}
                    />
                  }
                  label="Also settle the account"
                />
                {settleOn && (
                  <>
                    <TextField
                      label="Put against the account"
                      type="number"
                      value={settleValue}
                      onChange={(e) => setSettleRaw(e.target.value)}
                      slotProps={{
                        htmlInput: { min: 0, max: accountDue, step: "0.01" },
                        // The figure follows the cash rather than being typed,
                        // so the label has to be told to get out of its way.
                        inputLabel: { shrink: true },
                      }}
                      helperText={
                        spare <= 0
                          ? "Nothing left over yet. Enter the cash received above."
                          : `Up to ${formatMoney(Math.min(spare, accountDue))} of what is left over`
                      }
                      fullWidth
                    />
                    <Line
                      label="Account after this"
                      value={formatMoney(accountDue - toAccount)}
                      strong
                    />
                  </>
                )}
              </>
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
          {saving ? "Saving…" : "Record"}
        </Button>
      </DialogActions>
    </form>
  );
}
