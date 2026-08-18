"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
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
import type { ClientsAnalytics } from "@/types/entities";

// Clients & patients are point-in-time counts, so this section is a current
// snapshot rather than time-boxed. The new-clients chart shows the last 12 months
// for context.
export default function ClientsSection({ data }: { data: ClientsAnalytics }) {
  return (
    <AnalyticsSection title="Clients & patients" subtitle="Current snapshot">
      <KpiGrid>
        <KpiCard label="Active clients" value={String(data.totalActive)} />
        <KpiCard label="New this month" value={String(data.newThisMonth)} />
        <KpiCard label="Lapsed (6 mo)" value={String(data.lapsed)} />
        <KpiCard label="Total patients" value={String(data.totalPatients)} />
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
              { data: data.newTrend.map((t) => t.label), scaleType: "band" },
            ]}
            series={[
              { data: data.newTrend.map((t) => t.count), label: "New clients" },
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
    </AnalyticsSection>
  );
}
