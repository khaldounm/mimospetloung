"use client";

import { Box, Typography } from "@mui/material";
import { formatDateTime } from "@/utils/format";
import ProfitabilitySection from "./ProfitabilitySection";
import PurchasesSection from "./PurchasesSection";
import RevenueSection from "./RevenueSection";
import CategoriesSection from "./CategoriesSection";
import ClientsSection from "./ClientsSection";
import InventorySection from "./InventorySection";
import BookingsSection from "./BookingsSection";
import type { AnalyticsRange } from "@/types/entities";

// Sectioned analytics: each section is a collapsible accordion. Every section
// carries its own date-range calendar and re-queries on demand; the figures that
// are a position rather than a period (stock on hand, clients on file) are
// labelled as such inside their section. Profitability needs costs:read,
// Purchases needs orders:read.
//
// Every section fetches itself the first time it is opened. Nothing here is
// computed at first paint: the page arrived with all seven already calculated,
// which was 34 queries to fill accordions that were all closed.
//
// Clients starts on a year where the others start on the current month, because
// its lapsed list is the question "who has not been in", and asked of a single
// month the answer is very nearly every client on file.
//
// Inventory is half snapshot and half flow: stock levels are a position, while
// the top-sellers and the per-item lookup are range-scoped and share the
// section's own date picker. They live here rather than in a section of their
// own because "what sold" and "what is left" are the same question asked twice,
// and the client reads them together.
//
// Category performance follows Revenue because it splits the same billed figure
// by business line and compares it against an earlier window. It reports billed
// revenue, never collected: cash settles an invoice, not a line, so it cannot be
// attributed to a category.
//
// Purchases sits directly after Profitability so the two are read together and
// never confused: profit recognises stock cost when it sells, purchases records
// the cash leaving. Neither figure belongs inside the other.
export default function AnalyticsDashboard({
  defaultRange,
  clientsRange,
  generatedAt,
  canSeeProfit,
  canSeePurchases,
}: {
  defaultRange: AnalyticsRange;
  clientsRange: AnalyticsRange;
  generatedAt: string;
  canSeeProfit: boolean;
  canSeePurchases: boolean;
}) {
  return (
    <Box>
      {canSeeProfit && <ProfitabilitySection initialRange={defaultRange} />}
      {canSeePurchases && <PurchasesSection initialRange={defaultRange} />}
      <RevenueSection initialRange={defaultRange} />
      <CategoriesSection initialRange={defaultRange} />
      <ClientsSection initialRange={clientsRange} />
      <InventorySection initialRange={defaultRange} />
      <BookingsSection initialRange={defaultRange} />

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 2 }}
      >
        Generated {formatDateTime(generatedAt)}
      </Typography>
    </Box>
  );
}
