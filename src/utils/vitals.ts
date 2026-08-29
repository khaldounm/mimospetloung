import type { ClinicalRecordDTO } from "@/types/entities";

// Vitals are recorded per visit and read in three places that must agree: the
// timeline on screen, the chart above it, and the printed medical record. The
// units and the number of decimals live here so a weight cannot print as
// "12.4 kg" on paper and "12.40 kg" on screen.

export const TEMPERATURE_UNIT = "°C";
export const WEIGHT_UNIT = "kg";

/** "38.5 °C", or null when nothing was taken. */
export function formatTemperature(value: string | null): string | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)} ${TEMPERATURE_UNIT}` : null;
}

/** "12.4 kg", trailing zeros trimmed: a scale reading, not an accountant's. */
export function formatWeight(value: string | null): string | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${Number(n.toFixed(2))} ${WEIGHT_UNIT}`;
}

/** One visit that carried at least one reading. */
export interface VitalsPoint {
  /** "YYYY-MM-DD", the date the reading was taken. */
  date: string;
  temperature: number | null;
  weight: number | null;
}

/**
 * The plottable history, oldest first.
 *
 * Records with neither reading are dropped rather than plotted as gaps: a
 * grooming with no scale involved is not a missing measurement, it is not a
 * measurement at all, and showing it as a hole in the line invites someone to
 * read a weight loss into an empty afternoon.
 */
export function vitalsHistory(records: ClinicalRecordDTO[]): VitalsPoint[] {
  return records
    .map((r) => {
      const temperature = r.temperature == null ? null : Number(r.temperature);
      const weight = r.weight == null ? null : Number(r.weight);
      return {
        date: r.performedAt,
        temperature: Number.isFinite(temperature) ? temperature : null,
        weight: Number.isFinite(weight) ? weight : null,
      };
    })
    .filter((p) => p.temperature != null || p.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Whether there is enough history to be worth drawing a chart for. */
export function hasVitalsTrend(points: VitalsPoint[]): boolean {
  return (
    points.filter((p) => p.temperature != null).length >= 2 ||
    points.filter((p) => p.weight != null).length >= 2
  );
}

// ---- Projection, for the chart drawn into the PDF ----
//
// On screen MUI scales the axes. The printed copy has no chart library behind
// it, so the same picture is drawn as plain SVG and the arithmetic lives here.

export interface Projected {
  /** Lowest and highest reading, after padding, as the axis is labelled. */
  min: number;
  max: number;
  points: { x: number; y: number; value: number }[];
}

/**
 * The window the x axis spans. Taken across every point rather than per series
 * so weight and temperature are plotted against one shared timeline: two axes
 * with different date ranges would put readings from the same visit in
 * different columns.
 */
export function timeExtent(points: VitalsPoint[]): {
  start: number;
  end: number;
} {
  const times = points.map((p) => new Date(p.date).getTime());
  const start = Math.min(...times);
  const end = Math.max(...times);
  // A history with one date, or several on the same day, has no width. Give it
  // one so the divisor below is never zero.
  return { start, end: end > start ? end : start + 1 };
}

/**
 * One series projected into a box, y measured down from the top as SVG counts.
 *
 * Returns null when there is nothing to draw. A flat series is padded by one
 * unit either side so a pet at a steady 4.2 kg gets a line through the middle
 * of the box rather than one pinned to an edge.
 */
export function projectSeries(
  points: VitalsPoint[],
  pick: (p: VitalsPoint) => number | null,
  box: { width: number; height: number },
  extent: { start: number; end: number },
): Projected | null {
  const taken = points
    .map((p) => ({ time: new Date(p.date).getTime(), value: pick(p) }))
    .filter((p): p is { time: number; value: number } => p.value != null);
  if (taken.length === 0) return null;

  const values = taken.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const [min, max] = lo === hi ? [lo - 1, hi + 1] : [lo, hi];
  const span = max - min;
  const window = extent.end - extent.start;

  return {
    min,
    max,
    points: taken.map((p) => ({
      x: ((p.time - extent.start) / window) * box.width,
      y: box.height - ((p.value - min) / span) * box.height,
      value: p.value,
    })),
  };
}
