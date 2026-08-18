"use client";

import { Box, Typography } from "@mui/material";
import { formatDateTime } from "@/utils/format";
import ProfitabilitySection from "./ProfitabilitySection";
import PurchasesSection from "./PurchasesSection";
import RevenueSection from "./RevenueSection";
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
      <ClientsSection data={data.clients} />
      <InventorySection data={data.inventory} />
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
