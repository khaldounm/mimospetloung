"use client";

import { useMemo } from "react";
import { Paper, Stack, Typography } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import { formatDate } from "@/utils/format";
import {
  hasVitalsTrend,
  vitalsHistory,
  TEMPERATURE_UNIT,
  WEIGHT_UNIT,
} from "@/utils/vitals";
import type { ClinicalRecordDTO } from "@/types/entities";

/**
 * Weight and temperature across a patient's visits.
 *
 * Two axes, because the two readings share nothing but a date: a cat's weight
 * moves between 3 and 6 while its temperature barely leaves 38, and on one
 * scale the weight line would be a flat smear along the bottom.
 *
 * The x axis is time-proportional rather than one step per visit. A pet seen
 * weekly through an illness and then not for two years should show that gap;
 * evenly spacing the visits would draw the recovery and the two quiet years at
 * the same width and invent a trend that is not there.
 */
export default function VitalsChart({
  records,
}: {
  records: ClinicalRecordDTO[];
}) {
  const points = useMemo(() => vitalsHistory(records), [records]);

  if (!hasVitalsTrend(points)) return null;

  const dates = points.map((p) => new Date(p.date));
  const weights = points.map((p) => p.weight);
  const temperatures = points.map((p) => p.temperature);
  const hasWeight = weights.some((w) => w != null);
  const hasTemperature = temperatures.some((t) => t != null);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "baseline", mb: 1, flexWrap: "wrap" }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Weight and temperature
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {points.length} {points.length === 1 ? "visit" : "visits"} with a
          reading
        </Typography>
      </Stack>
      <LineChart
        height={260}
        xAxis={[
          {
            data: dates,
            scaleType: "time",
            valueFormatter: (d: Date) => formatDate(d.toISOString()),
          },
        ]}
        yAxis={[
          { id: "weight", width: 46 },
          { id: "temperature", position: "right", width: 46 },
        ]}
        series={[
          ...(hasWeight
            ? [
                {
                  data: weights,
                  label: `Weight (${WEIGHT_UNIT})`,
                  yAxisId: "weight",
                  // A visit that took a temperature but no weight is a gap in
                  // this series, not a return to zero. Bridge it rather than
                  // dropping the line to the floor and back.
                  connectNulls: true,
                  valueFormatter: (v: number | null) =>
                    v == null ? "-" : `${v} ${WEIGHT_UNIT}`,
                },
              ]
            : []),
          ...(hasTemperature
            ? [
                {
                  data: temperatures,
                  label: `Temperature (${TEMPERATURE_UNIT})`,
                  yAxisId: "temperature",
                  connectNulls: true,
                  valueFormatter: (v: number | null) =>
                    v == null ? "-" : `${v} ${TEMPERATURE_UNIT}`,
                },
              ]
            : []),
        ]}
      />
    </Paper>
  );
}
