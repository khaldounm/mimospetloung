"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { CURRENCY, SECONDARY_CURRENCY } from "@/constants/clinic";
import { formatSecondaryMoney } from "@/utils/format";

interface Props {
  initialRate: number;
}

// The exchange rate lives in the database rather than in the code so it can be
// changed the morning it moves, without a deploy. Invoices freeze whatever it
// was when they were issued, so changing it here never rewrites history.
export default function ExchangeRateForm({ initialRate }: Props) {
  const [rate, setRate] = useState(String(initialRate));
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = Number(rate);
  const valid = Number.isFinite(parsed) && parsed > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    setSaving(true);
    try {
      await apiRequest("/api/settings", {
        method: "PATCH",
        body: { fxUsdLbp: rate },
      });
      setSaved("Exchange rate updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the rate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3, height: "100%" }}>
      <form onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <Typography variant="h6">Exchange rate</Typography>
          <Typography variant="body2" color="text.secondary">
            How many {SECONDARY_CURRENCY.code} one {CURRENCY.code} is worth.
            Used for the lira figures shown on invoices and for cash taken at
            the counter. An invoice keeps the rate it was issued at, so changing
            this never alters an invoice that has already gone out.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {saved && <Alert severity="success">{saved}</Alert>}
          <TextField
            label={`${SECONDARY_CURRENCY.code} per 1 ${CURRENCY.code}`}
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            slotProps={{ htmlInput: { min: 1000, step: "100" } }}
            helperText={
              valid
                ? `$1.00 = ${formatSecondaryMoney(1, parsed)}, $100.00 = ${formatSecondaryMoney(100, parsed)}`
                : "Enter a number"
            }
            required
            fullWidth
            // The card is half the page wide now; a rate is four or five
            // digits, so the field stops well short of the card's edge.
            sx={{ maxWidth: 320 }}
          />
          <Box>
            <Button
              type="submit"
              variant="contained"
              disabled={saving || !valid}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </Box>
        </Stack>
      </form>
    </Paper>
  );
}
