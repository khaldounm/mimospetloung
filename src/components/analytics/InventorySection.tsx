"use client";

import { Box, Stack, Typography } from "@mui/material";
import AnalyticsSection from "./AnalyticsSection";
import {
  ChartCard,
  ChartGrid,
  HorizontalBars,
  KpiCard,
  KpiGrid,
  money,
} from "./AnalyticsPrimitives";
import type { InventoryAnalytics } from "@/types/entities";

// Inventory figures are point-in-time stock levels, so this section is a current
// snapshot. "Most-sold" is the one flow metric and stays a rolling 90-day view.
export default function InventorySection({
  data,
}: {
  data: InventoryAnalytics;
}) {
  return (
    <AnalyticsSection title="Inventory" subtitle="Current snapshot">
      <KpiGrid>
        <KpiCard label="Total items" value={String(data.totalItems)} />
        <KpiCard label="Stock value" value={money(data.stockValuation)} />
        <KpiCard label="Low stock" value={String(data.lowStockCount)} />
        <KpiCard label="Out of stock" value={String(data.outOfStockCount)} />
        <KpiCard
          label="Expiring (30d)"
          value={String(data.expiringSoonCount)}
        />
      </KpiGrid>
      <ChartGrid>
        <ChartCard title="Most-sold items (90 days)">
          {data.topConsumed.length > 0 ? (
            <HorizontalBars
              items={data.topConsumed}
              formatter={(v) => String(v)}
            />
          ) : (
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No sales recorded in the last 90 days.
              </Typography>
            </Box>
          )}
        </ChartCard>
        <ChartCard title="Low-stock items">
          {data.lowStockItems.length > 0 ? (
            <Stack spacing={1} sx={{ py: 1 }}>
              {data.lowStockItems.map((it) => (
                <Stack
                  key={it.itemId}
                  direction="row"
                  sx={{ justifyContent: "space-between" }}
                >
                  <Typography variant="body2" noWrap sx={{ mr: 2 }}>
                    {it.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="error.main"
                    sx={{ flexShrink: 0 }}
                  >
                    {it.currentStock}
                    {it.unit ? ` ${it.unit}` : ""} / reorder at{" "}
                    {it.reorderLevel}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No items are below their reorder level.
              </Typography>
            </Box>
          )}
        </ChartCard>
        <ChartCard title="Out-of-stock items">
          {data.outOfStockItems.length > 0 ? (
            <Stack spacing={1} sx={{ py: 1 }}>
              {data.outOfStockItems.map((it) => (
                <Stack
                  key={it.itemId}
                  direction="row"
                  sx={{ justifyContent: "space-between" }}
                >
                  <Typography variant="body2" noWrap sx={{ mr: 2 }}>
                    {it.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="error.main"
                    sx={{ flexShrink: 0 }}
                  >
                    0{it.unit ? ` ${it.unit}` : ""}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Everything is in stock.
              </Typography>
            </Box>
          )}
        </ChartCard>
      </ChartGrid>
    </AnalyticsSection>
  );
}
