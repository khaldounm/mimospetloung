"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { apiRequest } from "@/utils/api-client";
import { formatDate } from "@/utils/format";
import { offerTerms } from "@/utils/offers";
import OfferFormDialog from "./OfferFormDialog";
import type { OfferDTO, OfferGrantResultDTO } from "@/types/entities";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Who is being given the offer. One from a client page, many from a list. */
  clientIds: number[];
  /** How to name them in the heading, e.g. "Majida Laham" or "8 clients". */
  clientLabel: string;
  /** Whether this user may also create an offer, not only pick one. */
  canManage: boolean;
  /** Called after a successful grant, so the caller can refresh what it shows. */
  onGranted: (result: OfferGrantResultDTO) => void;
}

// Pick a deal, give it to whoever is selected.
//
// The catalogue itself lives in Settings. An admin can still create one from
// here, through the same form, because the moment you have ten clients selected
// is exactly when you think of the offer, and walking away to Settings would
// lose the selection.
export default function OfferPickerDialog({
  open,
  onClose,
  clientIds,
  clientLabel,
  canManage,
  onGranted,
}: Props) {
  // Null until the catalogue has been read once. Loading and which offer is
  // selected are both DERIVED from it rather than written by the effect: an
  // effect that sets state on the way in kicks off a second render before
  // anything is on screen.
  const [offers, setOffers] = useState<OfferDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    apiRequest<{ offers: OfferDTO[] }>("/api/offers")
      .then((res) => {
        // An expired or retired offer cannot be given to anyone new, so it is
        // not worth showing in a list whose only purpose is giving one.
        if (live) setOffers(res.offers.filter((o) => o.grantable));
      })
      .catch((err: unknown) => {
        if (live) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load offers",
          );
        }
      });
    return () => {
      live = false;
    };
  }, [open]);

  const loading = open && offers === null && loadError === null;
  const list = offers ?? [];
  // One offer and nothing to choose between: it is already picked, so granting
  // is a single click from a list where the clients were chosen already.
  const selected = chosen ?? (list.length === 1 ? list[0]!.offerId : null);

  async function grant() {
    if (selected == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ result: OfferGrantResultDTO }>(
        "/api/offers/grants",
        { method: "POST", body: { offerId: selected, clientIds } },
      );
      onGranted(res.result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply offer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Apply an offer to {clientLabel}</DialogTitle>
      <DialogContent dividers>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {(error || loadError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error ?? loadError}
          </Alert>
        )}

        {!loading && list.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {canManage
              ? "No offers to give yet. Create one below, or manage the whole list in Settings."
              : "There are no offers to give. An admin creates them in Settings."}
          </Typography>
        )}

        {list.length > 0 && (
          <List dense disablePadding>
            {list.map((offer) => (
              <ListItemButton
                key={offer.offerId}
                selected={selected === offer.offerId}
                onClick={() => setChosen(offer.offerId)}
              >
                <ListItemText
                  primary={
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <span>{offer.name}</span>
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={offerTerms(offer)}
                      />
                    </Stack>
                  }
                  secondary={[
                    offer.expiresOn
                      ? `Expires ${formatDate(offer.expiresOn)}`
                      : "No expiry",
                    `${offer.liveCount} waiting`,
                    `${offer.redeemedCount} used`,
                  ].join(" · ")}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {canManage && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            sx={{ mt: 1 }}
            onClick={() => setFormOpen(true)}
          >
            New offer
          </Button>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
        <Button
          variant="contained"
          startIcon={<LocalOfferIcon />}
          disabled={busy || selected == null || clientIds.length === 0}
          onClick={() => void grant()}
        >
          {busy ? "Applying..." : `Apply to ${clientLabel}`}
        </Button>
      </DialogActions>

      {/* The same form Settings uses, so an offer typed here and an offer typed
          there are the same thing asked for the same way. */}
      {formOpen && (
        <OfferFormDialog
          open
          offer={null}
          onClose={() => setFormOpen(false)}
          onSaved={(offer) => {
            setOffers((prev) => [offer, ...(prev ?? [])]);
            setChosen(offer.offerId);
          }}
        />
      )}
    </Dialog>
  );
}
