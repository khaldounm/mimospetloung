"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  FormControlLabel,
  Switch,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { todayForDateInput } from "@/utils/format";
import ClientSearchField from "@/components/ui/ClientSearchField";
import type { ClientSearchResult } from "@/hooks/useClientSearch";
import type { InvoiceDTO } from "@/types/entities";

interface Props {
  open: boolean;
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

function InvoiceForm({ invoice, onClose, onSaved }: FormProps) {
  const editing = Boolean(invoice);
  // The client is searched server-side as it is typed. It used to be a select
  // fed by an unparameterised /api/clients call, which returns page one of 25
  // out of ~1,900 clients, so 98% of them could not be picked at all.
  const [client, setClient] = useState<ClientSearchResult | null>(
    invoice && invoice.clientId != null
      ? {
          clientId: invoice.clientId,
          label: invoice.clientName,
          phone: invoice.clientPhone,
        }
      : null,
  );
  // A walk-in is an anonymous counter sale: no client, so no account, no
  // statement and nobody to chase for a balance.
  const [walkIn, setWalkIn] = useState(invoice ? invoice.isWalkIn : false);
  // New invoices are due the day they are raised, which is what happens at a
  // counter. Still editable for anything being billed on terms.
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate ?? todayForDateInput(),
  );
  const [discountPct, setDiscountPct] = useState(invoice?.discountPct ?? "0");
  const [taxPct, setTaxPct] = useState(invoice?.taxPct ?? "0");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!walkIn && !client) {
      setError("Pick a client, or mark this as a walk-in.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        clientId: walkIn || !client ? "" : String(client.clientId),
        // A walk-in has no account to bill later, and the server refuses a due
        // date on one, so the default must not be sent with it.
        dueDate: walkIn ? "" : dueDate,
        discountPct,
        taxPct,
        notes,
      };
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
          <FormControlLabel
            control={
              <Switch
                checked={walkIn}
                onChange={(e) => {
                  setWalkIn(e.target.checked);
                  if (e.target.checked) setClient(null);
                }}
              />
            }
            label="Walk-in (no client)"
          />
          {walkIn ? (
            <Alert severity="info">
              This sale is not attached to any account, so it cannot be put on a
              statement or chased later. Take payment before the customer
              leaves.
            </Alert>
          ) : (
            <ClientSearchField
              value={client}
              onChange={setClient}
              required
              autoFocus
              showBalance
            />
          )}
          {!walkIn && (
            <TextField
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          )}
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
