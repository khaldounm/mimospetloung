"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { formatDate } from "@/utils/format";
import OfferFormDialog from "@/components/offers/OfferFormDialog";
import { offerTerms } from "@/utils/offers";
import type { OfferDTO } from "@/types/entities";

interface Props {
  initialOffers: OfferDTO[];
}

// One offer in the list. Kept to two lines because this card shares a row with
// two others: the name and its terms, then the numbers that say whether the
// campaign is doing anything.
function OfferRow({ offer, onEdit }: { offer: OfferDTO; onEdit: () => void }) {
  const retired = offer.archived;
  const expired = !offer.archived && !offer.grantable;

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "flex-start", opacity: offer.grantable ? 1 : 0.6 }}
    >
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {offer.name}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={offer.grantable ? "primary" : "default"}
            label={offerTerms(offer)}
          />
          {retired && <Chip size="small" label="Retired" />}
          {expired && <Chip size="small" color="warning" label="Expired" />}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {[
            `${offer.liveCount} waiting`,
            `${offer.redeemedCount} used`,
            offer.expiresOn
              ? `until ${formatDate(offer.expiresOn)}`
              : "no expiry",
          ].join(" · ")}
        </Typography>
      </Box>
      <IconButton
        size="small"
        aria-label={`Edit ${offer.name}`}
        onClick={onEdit}
      >
        <EditIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

// The offer catalogue. It lives in Settings because an offer is a decision the
// clinic makes once and then hands out many times: if a deal can be invented at
// the counter, "20% off" stops meaning one thing and there is no campaign left
// to report on.
//
// Giving an offer to somebody happens elsewhere, on a client's page or from the
// top-clients list. This card is only where the deals themselves live.
export default function OffersCard({ initialOffers }: Props) {
  const [offers, setOffers] = useState(initialOffers);
  const [editing, setEditing] = useState<OfferDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function saved(offer: OfferDTO) {
    setOffers((prev) => {
      const without = prev.filter((o) => o.offerId !== offer.offerId);
      return [offer, ...without].sort((a, b) => {
        // Live ones first, then whatever was touched most recently, which for a
        // new offer is itself.
        if (a.grantable !== b.grantable) return a.grantable ? -1 : 1;
        return b.offerId - a.offerId;
      });
    });
  }

  return (
    <Paper variant="outlined" sx={{ p: 3, height: "100%" }}>
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Typography variant="h6">Offers</Typography>
        <Typography variant="body2" color="text.secondary">
          Deals the clinic gives out: a percentage or an amount off a whole
          invoice. Create one here, then hand it to a client from their page or
          from the top-clients list in Analytics. It comes off their next draft
          invoice, once.
        </Typography>

        {offers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No offers yet.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {offers.map((offer) => (
              <OfferRow
                key={offer.offerId}
                offer={offer}
                onEdit={() => {
                  setEditing(offer);
                  setFormOpen(true);
                }}
              />
            ))}
          </Stack>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          sx={{ alignSelf: "flex-start" }}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          New offer
        </Button>
      </Stack>

      {/* Remounted per open, so the form's fields start from whichever offer
          was clicked rather than from the last one. */}
      {formOpen && (
        <OfferFormDialog
          open
          offer={editing}
          onClose={() => setFormOpen(false)}
          onSaved={saved}
        />
      )}
    </Paper>
  );
}
