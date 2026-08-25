"use client";

import { Box, Typography } from "@mui/material";
import { formatMoney } from "@/utils/format";
import { SAMPLE_PAYOUT_COST, SAMPLE_PAYOUT_PRICE } from "@/constants/partners";

// Two free-form percentages describe a deal precisely but read abstractly, so
// the form shows what they mean on one concrete sale. Illustration only: the
// figures the clinic is actually billed come from computePartnerPayable in
// lib/partners, which works in Decimal and is the only authority. The arithmetic
// is repeated here rather than imported because that module reaches for the
// database, and a fixed sample cannot drift far enough to mislead.
export default function PayoutPreview({
  costPct,
  profitPct,
}: {
  costPct: string;
  profitPct: string;
}) {
  const cost = Number(costPct);
  const profit = Number(profitPct);
  if (!Number.isFinite(cost) || !Number.isFinite(profit)) return null;

  const margin = SAMPLE_PAYOUT_PRICE - SAMPLE_PAYOUT_COST;
  const partner = (SAMPLE_PAYOUT_COST * cost) / 100 + (margin * profit) / 100;
  const clinic = SAMPLE_PAYOUT_PRICE - partner;

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: "action.hover",
        border: 1,
        borderColor: "divider",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        On an item costing {formatMoney(SAMPLE_PAYOUT_COST)} that sells for{" "}
        {formatMoney(SAMPLE_PAYOUT_PRICE)}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        Partner gets <strong>{formatMoney(partner)}</strong>, clinic keeps{" "}
        <strong>{formatMoney(clinic)}</strong>
        {clinic < 0 && " (the clinic pays out more than the sale brings in)"}
      </Typography>
    </Box>
  );
}
