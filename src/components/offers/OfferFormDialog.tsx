"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
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
import { todayForDateInput } from "@/utils/format";
import {
  OFFER_QUICK_PERCENTAGES,
  type OfferDiscountMode,
} from "@/constants/offers";
import type { OfferDTO } from "@/types/entities";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The offer being edited, or null to create one. */
  offer: OfferDTO | null;
  onSaved: (offer: OfferDTO) => void;
}

// Create or edit one offer. The single place an offer's terms are typed, so
// Settings and the pick-an-offer dialog cannot drift into asking for them two
// different ways.
//
// Terms stay editable after an offer has been given out, because a campaign
// extended by a week is the same campaign and grants read their offer live.
// What is already spent keeps whatever the invoice froze.
export default function OfferFormDialog({
  open,
  onClose,
  offer,
  onSaved,
}: Props) {
  const editing = offer !== null;
  // Keyed on the dialog being reopened rather than reset by an effect: the
  // parent unmounts this between opens, so plain initial state is the reset.
  const [name, setName] = useState(offer?.name ?? "");
  const [mode, setMode] = useState<OfferDiscountMode>(
    offer?.discountMode ?? "pct",
  );
  const [value, setValue] = useState(
    offer
      ? offer.discountMode === "pct"
        ? String(Number(offer.discountPct))
        : String(Number(offer.discountAmount))
      : "10",
  );
  const [expiresOn, setExpiresOn] = useState(offer?.expiresOn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(value);
  const valid = name.trim().length > 0 && Number.isFinite(amount) && amount > 0;

  async function save(archived?: boolean) {
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        discountMode: mode,
        discountPct: mode === "pct" ? amount : 0,
        discountAmount: mode === "amount" ? amount : 0,
        expiresOn: expiresOn || null,
        ...(archived === undefined ? {} : { archived }),
      };
      const res = editing
        ? await apiRequest<{ offer: OfferDTO }>(
            `/api/offers/${offer.offerId}`,
            {
              method: "PATCH",
              body,
            },
          )
        : await apiRequest<{ offer: OfferDTO }>("/api/offers", {
            method: "POST",
            body,
          });
      onSaved(res.offer);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the offer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{editing ? "Edit offer" : "New offer"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Name"
            size="small"
            fullWidth
            autoFocus
            placeholder="September regulars"
            helperText="What staff will see when they hand it out"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mode}
              onChange={(_, next: OfferDiscountMode | null) =>
                next && setMode(next)
              }
            >
              <ToggleButton value="pct">Percent</ToggleButton>
              <ToggleButton value="amount">Amount</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              label={mode === "pct" ? "Percent off" : "Amount off"}
              size="small"
              type="number"
              sx={{ width: 130 }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              slotProps={{
                htmlInput: {
                  min: 0,
                  max: mode === "pct" ? 100 : undefined,
                  step: mode === "pct" ? 1 : 0.5,
                },
              }}
            />
          </Stack>

          {mode === "pct" && (
            <Stack direction="row" spacing={1}>
              {OFFER_QUICK_PERCENTAGES.map((p) => (
                <Chip
                  key={p}
                  size="small"
                  label={`${p}%`}
                  variant={amount === p ? "filled" : "outlined"}
                  color={amount === p ? "primary" : "default"}
                  onClick={() => setValue(String(p))}
                />
              ))}
            </Stack>
          )}

          <TextField
            label="Expires on"
            size="small"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            helperText="Leave empty to run until you retire it"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: todayForDateInput() },
            }}
          />

          <Typography variant="caption" color="text.secondary">
            The discount comes off the whole invoice, and one client can hold
            this offer once at a time.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        {/* Retiring stops the offer being given to anyone new. Whoever already
            holds one can still use it, and past grants keep naming it, which is
            why there is no delete. */}
        {editing && !offer.archived && (
          <Button
            color="warning"
            disabled={busy}
            onClick={() => void save(true)}
            sx={{ mr: "auto" }}
          >
            Retire
          </Button>
        )}
        {editing && offer.archived && (
          <Button
            color="success"
            disabled={busy}
            onClick={() => void save(false)}
            sx={{ mr: "auto" }}
          >
            Bring back
          </Button>
        )}
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={busy || !valid}
          onClick={() => void save()}
        >
          {busy ? "Saving..." : editing ? "Save" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
