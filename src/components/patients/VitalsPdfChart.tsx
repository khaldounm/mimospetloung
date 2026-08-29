import {
  Circle,
  G,
  Line,
  Polyline,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatDate } from "@/utils/format";
import {
  hasVitalsTrend,
  projectSeries,
  timeExtent,
  TEMPERATURE_UNIT,
  WEIGHT_UNIT,
  type Projected,
  type VitalsPoint,
} from "@/utils/vitals";

// The same picture the patient page draws, rendered as plain SVG because the
// PDF has no chart library behind it. Deliberately spare: on paper an owner
// wants the shape of the line and the two end values, not a grid.

const PLOT = { width: 452, height: 132 };
const PAD = { left: 34, right: 34, top: 12, bottom: 18 };

const COLORS = {
  weight: "#1976d2",
  temperature: "#c2410c",
  axis: "#d0d0d0",
  muted: "#666666",
  text: "#1a1a1a",
};

function polyline(series: Projected): string {
  return series.points.map((p) => `${p.x},${p.y}`).join(" ");
}

function Series({ series, color }: { series: Projected; color: string }) {
  return (
    <>
      {series.points.length > 1 && (
        <Polyline
          points={polyline(series)}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
        />
      )}
      {series.points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={1.9} fill={color} />
      ))}
    </>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}
    >
      <View
        style={{
          width: 8,
          height: 2,
          backgroundColor: color,
          marginRight: 4,
        }}
      />
      <Text style={{ fontSize: 7, color: COLORS.muted }}>{label}</Text>
    </View>
  );
}

export default function VitalsPdfChart({ points }: { points: VitalsPoint[] }) {
  if (!hasVitalsTrend(points)) return null;

  const extent = timeExtent(points);
  const weight = projectSeries(points, (p) => p.weight, PLOT, extent);
  const temperature = projectSeries(points, (p) => p.temperature, PLOT, extent);

  const firstDate = formatDate(new Date(extent.start).toISOString());
  const lastDate = formatDate(new Date(extent.end).toISOString());

  return (
    <View wrap={false} style={{ marginBottom: 12 }}>
      <Text
        style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 }}
      >
        Weight and temperature over time
      </Text>

      <Svg
        width={PLOT.width + PAD.left + PAD.right}
        height={PLOT.height + PAD.top + PAD.bottom}
      >
        {/* Baseline and left rule. A full grid would crowd a chart this size. */}
        <Line
          x1={PAD.left}
          y1={PAD.top + PLOT.height}
          x2={PAD.left + PLOT.width}
          y2={PAD.top + PLOT.height}
          stroke={COLORS.axis}
          strokeWidth={0.8}
        />
        <Line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + PLOT.height}
          stroke={COLORS.axis}
          strokeWidth={0.8}
        />

        {/* Weight reads off the left, temperature off the right: the two share
            a timeline and nothing else, so one scale would flatten whichever
            has the narrower range. */}
        {weight && (
          <>
            <Text
              x={PAD.left - 4}
              y={PAD.top + 4}
              style={{ fontSize: 6, textAnchor: "end", fill: COLORS.weight }}
            >
              {weight.max.toFixed(1)}
            </Text>
            <Text
              x={PAD.left - 4}
              y={PAD.top + PLOT.height}
              style={{ fontSize: 6, textAnchor: "end", fill: COLORS.weight }}
            >
              {weight.min.toFixed(1)}
            </Text>
          </>
        )}
        {temperature && (
          <>
            <Text
              x={PAD.left + PLOT.width + 4}
              y={PAD.top + 4}
              style={{
                fontSize: 6,
                textAnchor: "start",
                fill: COLORS.temperature,
              }}
            >
              {temperature.max.toFixed(1)}
            </Text>
            <Text
              x={PAD.left + PLOT.width + 4}
              y={PAD.top + PLOT.height}
              style={{
                fontSize: 6,
                textAnchor: "start",
                fill: COLORS.temperature,
              }}
            >
              {temperature.min.toFixed(1)}
            </Text>
          </>
        )}

        {/* Only the two ends are dated. Labelling every visit overlaps as soon
            as a patient has more than a handful. */}
        <Text
          x={PAD.left}
          y={PAD.top + PLOT.height + 12}
          style={{ fontSize: 6, textAnchor: "start", fill: COLORS.muted }}
        >
          {firstDate}
        </Text>
        <Text
          x={PAD.left + PLOT.width}
          y={PAD.top + PLOT.height + 12}
          style={{ fontSize: 6, textAnchor: "end", fill: COLORS.muted }}
        >
          {lastDate}
        </Text>

        <G transform={`translate(${PAD.left}, ${PAD.top})`}>
          {weight && <Series series={weight} color={COLORS.weight} />}
          {temperature && (
            <Series series={temperature} color={COLORS.temperature} />
          )}
        </G>
      </Svg>

      <View style={{ flexDirection: "row", marginTop: 4 }}>
        {weight && (
          <LegendKey color={COLORS.weight} label={`Weight (${WEIGHT_UNIT})`} />
        )}
        {temperature && (
          <LegendKey
            color={COLORS.temperature}
            label={`Temperature (${TEMPERATURE_UNIT})`}
          />
        )}
      </View>
    </View>
  );
}
