"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { formatDate, formatMoney, toDateOnly } from "@/utils/format";
import { PARTNER_PAYOUT_METHODS } from "@/constants/partner";
import type { PurchaseOrderDTO, SupplierDTO } from "@/types/entities";

interface Props {
  open: boolean;
  supplierId: number;
  supplierName: string;
  balance: string;
  /** Received orders only: an open order has no bill to settle yet. */
  payableOrders: PurchaseOrderDTO[];
  onClose: () => void;
  onSaved: (supplier: SupplierDTO | null) => void;
}

export default function SupplierPaymentFormDialog({
  open,
  onClose,
  ...rest
}: Props) {
  // Remount per open so the amount re-seeds from the current balance.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && <PaymentForm onClose={onClose} {...rest} />}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function PaymentForm({
  supplierId,
  supplierName,
  balance,
  payableOrders,
  onClose,
  onSaved,
}: FormProps) {
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(() => toDateOnly(new Date()) ?? "");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Picking a bill fills the amount with that order's total, since paying an
  // invoice in full is the common case. Still editable for a part payment.
  function handleOrderChange(value: string) {
    setOrderId(value);
    const picked = payableOrders.find((o) => String(o.orderId) === value);
    if (picked) setAmount(picked.total);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await apiRequest<{ supplier: SupplierDTO | null }>(
        `/api/suppliers/${supplierId}/payments`,
        {
          method: "POST",
          body: { orderId, amount, paidOn, method, reference, notes },
        },
      );
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
      <DialogTitle>Record payment to {supplierName}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Currently owed: <strong>{formatMoney(balance)}</strong>. Link a bill
          if this settles one order, or leave it blank to pay against the
          account.
        </DialogContentText>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label="Settling which bill?"
            value={orderId}
            onChange={(e) => handleOrderChange(e.target.value)}
            helperText={
              payableOrders.length === 0
                ? "No delivered orders yet, so this will pay against the account"
                : "Optional. Only delivered orders can be paid against."
            }
            fullWidth
          >
            <MenuItem value="">Against the account (no specific bill)</MenuItem>
            {payableOrders.map((o) => (
              <MenuItem key={o.orderId} value={String(o.orderId)}>
                {o.reference || `Order #${o.orderId}`} &middot;{" "}
                {formatMoney(o.total)}
                {o.receivedOn ? ` · ${formatDate(o.receivedOn)}` : ""}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
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
              label="Paid on"
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="Method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              fullWidth
            >
              <MenuItem value="">Not recorded</MenuItem>
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
              placeholder="Cheque or transfer number"
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
          {saving ? "Saving…" : "Record payment"}
        </Button>
      </DialogActions>
    </form>
  );
}
