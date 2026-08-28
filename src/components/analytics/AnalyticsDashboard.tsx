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
import type { AnalyticsDTO } from "@/types/entities";

// Sectioned analytics: each section is a collapsible accordion. The flow sections
// (Profitability, Purchases, Revenue, Bookings) carry their own date-range
// calendar and re-query on demand; the snapshot sections (Clients, Inventory)
// show current state. Profitability needs costs:read, Purchases needs
// orders:read.
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
export default function AnalyticsDashboard({ data }: { data: AnalyticsDTO }) {
  return (
    <Box>
      {data.profit && (
        <ProfitabilitySection
          initial={data.profit}
          initialRange={data.defaultRange}
        />
      )}
      {data.purchases && (
        <PurchasesSection
          initial={data.purchases}
          initialRange={data.defaultRange}
        />
      )}
      <RevenueSection initial={data.revenue} initialRange={data.defaultRange} />
      <CategoriesSection
        initial={data.categories}
        initialRange={data.defaultRange}
      />
      <ClientsSection data={data.clients} />
      <InventorySection
        data={data.inventory}
        initialItems={data.items}
        initialRange={data.defaultRange}
      />
      <BookingsSection
        initial={data.bookings}
        initialRange={data.defaultRange}
      />

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 2 }}
      >
        Generated {formatDateTime(data.generatedAt)}
      </Typography>
    </Box>
  );
}
