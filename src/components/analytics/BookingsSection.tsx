"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useAnalyticsSection } from "@/hooks/useAnalyticsSection";
import { rangeSummary } from "@/utils/date-range";
import DateRangeControl from "@/components/ui/DateRangeControl";
import AnalyticsSection from "./AnalyticsSection";
import {
  CHART_HEIGHT,
  ChartCard,
  ChartGrid,
  EmptyChart,
  KpiCard,
  KpiGrid,
  toPieData,
} from "./AnalyticsPrimitives";
import type { AnalyticsRange, BookingsAnalytics } from "@/types/entities";

export default function BookingsSection({
  initial,
  initialRange,
}: {
  initial: BookingsAnalytics;
  initialRange: AnalyticsRange;
}) {
  const { range, data, loading, setRange } =
    useAnalyticsSection<BookingsAnalytics>("bookings", initial, initialRange);

  return (
    <AnalyticsSection
      title="Bookings & operations"
      subtitle={rangeSummary(range)}
      loading={loading}
      controls={<DateRangeControl range={range} onChange={setRange} />}
    >
      <KpiGrid>
        <KpiCard label="Bookings" value={String(data.periodCount)} />
        <KpiCard label="Completed" value={`${data.completedRate}%`} />
        <KpiCard label="No-show" value={`${data.noShowRate}%`} />
        <KpiCard label="Cancelled" value={`${data.cancellationRate}%`} />
      </KpiGrid>
      <ChartGrid>
        <ChartCard title="Booking volume" full>
          <LineChart
            height={CHART_HEIGHT}
            xAxis={[
              {
                data: data.volumeTrend.map((t) => t.label),
                scaleType: "point",
              },
            ]}
            series={[
              { data: data.volumeTrend.map((t) => t.count), label: "Bookings" },
            ]}
          />
        </ChartCard>
        <ChartCard title="Status mix">
          {data.statusMix.length > 0 ? (
            <PieChart
              height={CHART_HEIGHT}
              series={[{ data: toPieData(data.statusMix) }]}
            />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
        <ChartCard title="Bookings by weekday">
          <BarChart
            height={CHART_HEIGHT}
            xAxis={[
              { data: data.byWeekday.map((d) => d.label), scaleType: "band" },
            ]}
            series={[
              { data: data.byWeekday.map((d) => d.count), label: "Bookings" },
            ]}
          />
        </ChartCard>
      </ChartGrid>
    </AnalyticsSection>
  );
}
