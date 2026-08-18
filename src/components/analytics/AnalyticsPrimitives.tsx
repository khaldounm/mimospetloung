"use client";

import { Box, Paper, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { formatMoney } from "@/utils/format";
import type { NamedCount, NamedValue } from "@/types/entities";

export const CHART_HEIGHT = 280;

export const money = (v: number | null) => formatMoney(v ?? 0);

export function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(3, 1fr)",
          md: "repeat(5, 1fr)",
        },
      }}
    >
      {children}
    </Box>
  );
}

export function ChartGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        mt: 2,
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
      }}
    >
      {children}
    </Box>
  );
}

export function ChartCard({
  title,
  children,
  full,
}: {
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, gridColumn: full ? { md: "1 / -1" } : undefined }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

export function EmptyChart() {
  return (
    <Box
      sx={{
        height: CHART_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        No data in this range.
      </Typography>
    </Box>
  );
}

// Horizontal bar chart for ranked label/value lists (services, sold items).
export function HorizontalBars({
  items,
  formatter,
}: {
  items: NamedValue[];
  formatter: (v: number) => string;
}) {
  return (
    <BarChart
      layout="horizontal"
      height={CHART_HEIGHT}
      margin={{ left: 8 }}
      yAxis={[
        { data: items.map((i) => i.label), scaleType: "band", width: 120 },
      ]}
      series={[
        {
          data: items.map((i) => i.value),
          valueFormatter: (v) => formatter(v ?? 0),
        },
      ]}
    />
  );
}

export function toPieData(items: NamedCount[]) {
  return items.map((it, idx) => ({
    id: idx,
    value: it.count,
    label: it.label,
  }));
}
