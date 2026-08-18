"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { useAnalyticsSection } from "@/hooks/useAnalyticsSection";
import { rangeSummary } from "@/utils/date-range";
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
import type { AnalyticsRange, RevenueAnalytics } from "@/types/entities";

export default function RevenueSection({
  initial,
  initialRange,
}: {
  initial: RevenueAnalytics;
  initialRange: AnalyticsRange;
}) {
  const { range, data, loading, setRange } =
    useAnalyticsSection<RevenueAnalytics>("revenue", initial, initialRange);
  const trendHasData = data.trend.some(
    (t) => t.collected > 0 || t.outstanding > 0,
  );

  return (
    <AnalyticsSection
      title="Revenue & financial"
      subtitle={rangeSummary(range)}
      loading={loading}
      controls={<DateRangeControl range={range} onChange={setRange} />}
    >
      <KpiGrid>
        <KpiCard label="Collected" value={money(data.periodCollected)} />
        <KpiCard label="Invoiced" value={money(data.periodInvoiced)} />
        <KpiCard
          label="Outstanding (now)"
          value={money(data.outstandingTotal)}
        />
        <KpiCard label="Avg invoice" value={money(data.avgInvoiceValue)} />
        <KpiCard label="Void rate" value={`${data.voidRate}%`} />
      </KpiGrid>
      <ChartGrid>
        <ChartCard title="Revenue trend" full>
          {trendHasData ? (
            <LineChart
              height={CHART_HEIGHT}
              xAxis={[
                { data: data.trend.map((t) => t.label), scaleType: "point" },
              ]}
              series={[
                {
                  data: data.trend.map((t) => t.collected),
                  label: "Collected",
                  valueFormatter: (v) => money(v),
                },
                {
                  data: data.trend.map((t) => t.outstanding),
                  label: "Outstanding",
                  valueFormatter: (v) => money(v),
                },
              ]}
            />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
        <ChartCard title="Outstanding by age (as of today)">
          <BarChart
            height={CHART_HEIGHT}
            xAxis={[
              {
                data: ["Current", "1-30d", "31-60d", "61+ d"],
                scaleType: "band",
              },
            ]}
            series={[
              {
                data: [
                  data.aging.current,
                  data.aging.d1to30,
                  data.aging.d31to60,
                  data.aging.d61plus,
                ],
                label: "Balance",
                valueFormatter: (v) => money(v),
              },
            ]}
          />
        </ChartCard>
        <ChartCard title="Top services by revenue">
          {data.byService.length > 0 ? (
            <HorizontalBars items={data.byService} formatter={money} />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </ChartGrid>
    </AnalyticsSection>
  );
}
