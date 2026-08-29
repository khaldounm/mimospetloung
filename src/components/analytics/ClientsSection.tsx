"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useAnalyticsSection } from "@/hooks/useAnalyticsSection";
import AnalyticsSection from "./AnalyticsSection";
import {
  CHART_HEIGHT,
  ChartCard,
  ChartGrid,
  EmptyChart,
  KpiCard,
  KpiGrid,
  SectionPlaceholder,
  toPieData,
} from "./AnalyticsPrimitives";
import type { AnalyticsRange, ClientsAnalytics } from "@/types/entities";

// Clients & patients are point-in-time counts, so this section is a current
// snapshot rather than time-boxed. The new-clients chart shows the last 12 months
// for context.
export default function ClientsSection({
  initialRange,
}: {
  // Unused for the figures, which are a position rather than a period. Taken so
  // every section is constructed the same way.
  initialRange: AnalyticsRange;
}) {
  const { data, loading, error, load } = useAnalyticsSection<ClientsAnalytics>(
    "clients",
    initialRange,
  );

  return (
    <AnalyticsSection
      title="Clients & patients"
      subtitle="Current snapshot"
      loading={loading}
      onExpand={load}
    >
      {data ? (
        <>
          <KpiGrid>
            <KpiCard label="Active clients" value={String(data.totalActive)} />
            <KpiCard label="New this month" value={String(data.newThisMonth)} />
            <KpiCard label="Lapsed (6 mo)" value={String(data.lapsed)} />
            <KpiCard
              label="Total patients"
              value={String(data.totalPatients)}
            />
            <KpiCard
              label="Patients / client"
              value={String(data.avgPatientsPerClient)}
            />
          </KpiGrid>
          <ChartGrid>
            <ChartCard title="New clients (12 months)">
              <BarChart
                height={CHART_HEIGHT}
                xAxis={[
                  {
                    data: data.newTrend.map((t) => t.label),
                    scaleType: "band",
                  },
                ]}
                series={[
                  {
                    data: data.newTrend.map((t) => t.count),
                    label: "New clients",
                  },
                ]}
              />
            </ChartCard>
            <ChartCard title="Patients by species">
              {data.speciesMix.length > 0 ? (
                <PieChart
                  height={CHART_HEIGHT}
                  series={[{ data: toPieData(data.speciesMix) }]}
                />
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
          </ChartGrid>
        </>
      ) : (
        <SectionPlaceholder error={error} />
      )}
    </AnalyticsSection>
  );
}
