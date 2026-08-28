"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  InputAdornment,
  Switch,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { formatMoney, todayForDateInput } from "@/utils/format";
import {
  adjustmentFor,
  previewInvoiceMoney,
  type DiscountMode,
} from "@/utils/invoice-money";
import { CURRENCY } from "@/constants/clinic";
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
  // One discount, two ways of typing it. Which mode the invoice is already in
  // is read off the row: a non-zero discount_amount means it was typed as money.
  const [discountMode, setDiscountMode] = useState<DiscountMode>(
    invoice && Number(invoice.discountAmount) > 0 ? "amount" : "pct",
  );
  const [discountInput, setDiscountInput] = useState(
    invoice && Number(invoice.discountAmount) > 0
      ? invoice.discountAmount
      : (invoice?.discountPct ?? "0"),
  );
  const [taxPct, setTaxPct] = useState(invoice?.taxPct ?? "0");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // What the invoice comes to before rounding, recomputed from the frozen
  // subtotal as the discount and tax are typed. The same arithmetic the server
  // will do on save, so what is shown here is what gets stored.
  const preview = previewInvoiceMoney({
    subtotal: Number(invoice?.subtotal ?? 0),
    discountMode,
    discountInput: Number(discountInput) || 0,
    taxPct: Number(taxPct) || 0,
  });

  // Prefilled with what the invoice currently charges, so an untouched field
  // reproduces the adjustment already on the row instead of silently clearing
  // it. Typing a round figure here is the whole feature: 101.12 becomes 100.
  const [chargeTotal, setChargeTotal] = useState(
    invoice ? Number(invoice.total).toFixed(2) : "",
  );
  const adjustment =
    chargeTotal.trim() === ""
      ? 0
      : adjustmentFor(preview.totalBeforeAdjustment, Number(chargeTotal) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!walkIn && !client) {
      setError("Pick a client, or mark this as a walk-in.");
      return;
    }
    setSaving(true);
    try {
      // Only the mode in use is sent with a value; the other goes as 0 so the
      // server clears it and the row never carries both. See discountPatch.
      const discount = Number(discountInput) || 0;
      const body = {
        clientId: walkIn || !client ? "" : String(client.clientId),
        // A walk-in has no account to bill later, and the server refuses a due
        // date on one, so the default must not be sent with it.
        dueDate: walkIn ? "" : dueDate,
        discountPct: discountMode === "pct" ? String(discount) : "0",
        discountAmount: discountMode === "amount" ? String(discount) : "0",
        taxPct,
        // The delta, not the target. Only an existing invoice has lines to
        // round, so a new draft never sends one.
        ...(editing ? { adjustment: String(adjustment) } : {}),
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
          <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
            <TextField
              label="Discount"
              type="number"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              slotProps={{
                htmlInput: {
                  min: 0,
                  // A percentage cannot go past 100; money can go as high as
                  // the invoice does, and the server clamps it to the subtotal.
                  ...(discountMode === "pct" ? { max: 100 } : {}),
                  step: "0.01",
                },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      {/* Two ways of saying one discount. "Ten dollars off" is
                          said at the counter as often as "ten percent", and
                          working a percentage back from a round figure lands on
                          9.99 as often as it lands on 10. */}
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={discountMode}
                        onChange={(_e, next: DiscountMode | null) => {
                          // A percentage and an amount are not interchangeable
                          // numbers: 10 means two completely different discounts
                          // either side of this switch. Clearing the field is
                          // the honest move, rather than silently rebilling.
                          if (!next || next === discountMode) return;
                          setDiscountMode(next);
                          setDiscountInput("0");
                        }}
                      >
                        <ToggleButton value="amount" aria-label="Amount off">
                          {CURRENCY.symbol}
                        </ToggleButton>
                        <ToggleButton value="pct" aria-label="Percent off">
                          %
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </InputAdornment>
                  ),
                },
              }}
              helperText={
                discountMode === "pct"
                  ? `${formatMoney(preview.discountValue)} off`
                  : "A flat amount off the subtotal"
              }
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

          {/* Rounding. Only an invoice that already has lines has anything to
              round, so a brand new draft never shows this. */}
          {editing && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Round the total
                </Typography>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ mt: 1.5, alignItems: "flex-start" }}
                >
                  <TextField
                    label="Works out to"
                    value={formatMoney(preview.totalBeforeAdjustment)}
                    slotProps={{ input: { readOnly: true } }}
                    fullWidth
                  />
                  <TextField
                    label="Charge"
                    type="number"
                    value={chargeTotal}
                    onChange={(e) => setChargeTotal(e.target.value)}
                    slotProps={{ htmlInput: { step: "0.01" } }}
                    helperText={
                      adjustment === 0
                        ? "Type a round figure to charge instead"
                        : `Adjustment ${adjustment > 0 ? "+" : "-"}${formatMoney(
                            Math.abs(adjustment),
                          )}`
                    }
                    fullWidth
                  />
                </Stack>
                {adjustment !== 0 && (
                  <Button
                    size="small"
                    sx={{ mt: 0.5 }}
                    onClick={() =>
                      setChargeTotal(preview.totalBeforeAdjustment.toFixed(2))
                    }
                  >
                    Clear the rounding
                  </Button>
                )}
              </Box>
              <Divider />
            </>
          )}
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
