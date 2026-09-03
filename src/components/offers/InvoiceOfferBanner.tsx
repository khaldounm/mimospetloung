"use client";

import { useState } from "react";
import { Alert, Button, Stack } from "@mui/material";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { apiRequest } from "@/utils/api-client";
import { formatDate } from "@/utils/format";
import { useClientOffers } from "@/hooks/useClientOffers";
import { offerTerms } from "@/utils/offers";
import type { InvoiceDTO } from "@/types/entities";

interface Props {
  invoice: InvoiceDTO;
  canWrite: boolean;
  /** Hands the recomputed invoice back so the totals redraw in place. */
  onApplied: (invoice: InvoiceDTO) => void;
}

// Tells the counter that this client is owed something, and applies it in one
// click.
//
// A banner rather than a dialog, and deliberately not another button in the
// action row above. That row already carries six, and a modal on open at a busy
// counter gets dismissed unread, which is the one outcome that makes the whole
// feature pointless. This sits in the flow, states the deal in words, and can
// be ignored.
export default function InvoiceOfferBanner({
  invoice,
  canWrite,
  onApplied,
}: Props) {
  const { grants, redeemable, reload } = useClientOffers(invoice.clientId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = invoice.status === "Draft";
  // An offer already spent on THIS invoice. Shown so the discount on the
  // totals below is never an unexplained number.
  const applied = grants.find((g) => g.redeemedInvoiceId === invoice.invoiceId);

  async function apply() {
    if (!redeemable) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{
        invoice: InvoiceDTO;
        replaced: string | null;
      }>(`/api/invoices/${invoice.invoiceId}/offer`, {
        method: "POST",
        body: { grantId: redeemable.grantId },
      });
      onApplied(res.invoice);
      // Said out loud rather than swallowed: an offer landing on an invoice
      // that already carried a typed discount replaces it, and the person who
      // typed that discount needs to know it is gone.
      if (res.replaced) {
        setError(
          `Applied. This replaced the ${res.replaced} discount that was already on the invoice.`,
        );
      }
      reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to apply the offer",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ invoice: InvoiceDTO }>(
        `/api/invoices/${invoice.invoiceId}/offer`,
        { method: "DELETE" },
      );
      onApplied(res.invoice);
      reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove the offer",
      );
    }
    setBusy(false);
  }

  if (applied) {
    return (
      <Alert
        severity="success"
        icon={<LocalOfferIcon />}
        sx={{ mb: 2 }}
        action={
          canWrite && isDraft ? (
            <Button
              size="small"
              color="inherit"
              disabled={busy}
              onClick={() => void remove()}
            >
              Remove
            </Button>
          ) : undefined
        }
      >
        {applied.offerName} applied: {offerTerms(applied)}. The discount below
        is this offer.
      </Alert>
    );
  }

  // Nothing to say. An issued invoice is frozen, so offering to discount it
  // would be an offer nobody can accept.
  if (!redeemable || !isDraft || !canWrite) return null;

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      <Alert
        severity="info"
        icon={<LocalOfferIcon />}
        action={
          <Button
            size="small"
            variant="contained"
            disabled={busy}
            onClick={() => void apply()}
          >
            {busy ? "Applying..." : "Apply"}
          </Button>
        }
      >
        {invoice.clientName} has an offer waiting: {redeemable.offerName},{" "}
        {offerTerms(redeemable)}
        {redeemable.expiresOn
          ? `, until ${formatDate(redeemable.expiresOn)}`
          : ""}
        .
      </Alert>
      {error && <Alert severity="warning">{error}</Alert>}
    </Stack>
  );
}
