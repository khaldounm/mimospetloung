"use client";

import Link from "next/link";
import { Button, Stack, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import DescriptionIcon from "@mui/icons-material/Description";
import { useAnalyticsSection } from "@/hooks/useAnalyticsSection";
import { rangeQuery, rangeSummary } from "@/utils/date-range";
import DateRangeControl from "@/components/ui/DateRangeControl";
import AnalyticsSection from "./AnalyticsSection";
import {
  CHART_HEIGHT,
  ChartCard,
  ChartGrid,
  EmptyChart,
  HorizontalBars,
  KpiCard,
  KpiGrid,
  money,
} from "./AnalyticsPrimitives";
import type { AnalyticsRange, PurchasesAnalytics } from "@/types/entities";

export default function PurchasesSection({
  initial,
  initialRange,
}: {
  initial: PurchasesAnalytics;
  initialRange: AnalyticsRange;
}) {
  const { range, data, loading, setRange } =
    useAnalyticsSection<PurchasesAnalytics>("purchases", initial, initialRange);
  const trendHasData = data.trend.some((t) => t.billed > 0 || t.paid > 0);

  return (
    <AnalyticsSection
      title="Purchases"
      subtitle={rangeSummary(range)}
      loading={loading}
      controls={<DateRangeControl range={range} onChange={setRange} />}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        What the clinic was billed by suppliers and what it actually paid them.
        These figures are <strong>not</strong> part of net profit and never
        reduce it: stock cost reaches the profit report as COGS on the day the
        item sells, so counting a purchase here as well would charge the same
        stock twice. Read this alongside Profitability, not inside it.
      </Typography>

      <KpiGrid>
        <KpiCard label="Billed" value={money(data.periodBilled)} />
        <KpiCard label="Paid" value={money(data.periodPaid)} />
        <KpiCard
          label="Orders delivered"
          value={String(data.periodOrderCount)}
        />
        <KpiCard label="Owed now" value={money(data.owedNow)} />
        <KpiCard label="In progress now" value={money(data.inProgressNow)} />
      </KpiGrid>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 2, display: "block" }}
      >
        Billed, Paid and Orders delivered cover{" "}
        {rangeSummary(range).toLowerCase()}. Owed now and In progress now are
        the position as it stands today, not for the period.
        {data.creditNow > 0 &&
          ` A further ${money(data.creditNow)} is held in credit, paid with no bill recorded against it.`}
      </Typography>

      <ChartGrid>
        <ChartCard title="Billed against paid" full>
          {trendHasData ? (
            <BarChart
              height={CHART_HEIGHT}
              xAxis={[
                { data: data.trend.map((t) => t.label), scaleType: "band" },
              ]}
              series={[
                {
                  data: data.trend.map((t) => t.billed),
                  label: "Billed",
                  valueFormatter: (v) => money(v ?? 0),
                },
                {
                  data: data.trend.map((t) => t.paid),
                  label: "Paid",
                  valueFormatter: (v) => money(v ?? 0),
                },
              ]}
            />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
        <ChartCard title="Top suppliers by spend">
          {data.bySupplier.length > 0 ? (
            <HorizontalBars items={data.bySupplier} formatter={money} />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </ChartGrid>

      <Stack direction="row" sx={{ mt: 2 }}>
        <Button
          component={Link}
          href={`/orders/statement?${rangeQuery(range)}`}
          variant="outlined"
          size="small"
          startIcon={<DescriptionIcon />}
        >
          Open the statement for this period
        </Button>
      </Stack>
    </AnalyticsSection>
  );
}
