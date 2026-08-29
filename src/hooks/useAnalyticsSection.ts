"use client";

import { useCallback, useRef, useState } from "react";
import { apiRequest } from "@/utils/api-client";
import type { AnalyticsRange } from "@/types/entities";
import { ANALYTICS_SECTIONS } from "@/schemas/analytics";
import type { AnalyticsPanel } from "@/schemas/analytics";

interface SectionState<T> {
  range: AnalyticsRange;
  /** Null until the section has been opened at least once. */
  data: T | null;
  loading: boolean;
  error: string | null;
  setRange: (next: AnalyticsRange) => void;
  /** Fetches the section for its current range. Safe to call repeatedly. */
  load: () => void;
}

// Owns one analytics section's range and data, and fetches it the first time
// the section is opened.
//
// Nothing is computed for a section nobody looks at. The page used to arrive
// with all seven sections already calculated, 34 queries deep, behind seven
// accordions that were all closed. A request id guards against out-of-order
// responses when the range is changed rapidly.
export function useAnalyticsSection<T>(
  section: AnalyticsPanel,
  initialRange: AnalyticsRange,
): SectionState<T> {
  const [range, setRangeState] = useState(initialRange);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  // Whether a fetch has ever been started, so re-opening a section does not
  // refetch what it is already showing.
  const started = useRef(false);

  const fetchFor = useCallback(
    (next: AnalyticsRange | null) => {
      started.current = true;
      const requestId = ++latest.current;
      setLoading(true);
      setError(null);

      const query = new URLSearchParams({ section });
      // Snapshot sections take no range, and the route rejects one.
      if (next) {
        query.set("from", next.from);
        query.set("to", next.to);
      }
      apiRequest<{ data: T }>(`/api/analytics?${query.toString()}`)
        .then((res) => {
          if (requestId === latest.current) setData(res.data);
        })
        .catch((err: unknown) => {
          if (requestId === latest.current) {
            setError(err instanceof Error ? err.message : "Failed to load");
          }
        })
        .finally(() => {
          if (requestId === latest.current) setLoading(false);
        });
    },
    [section],
  );

  // A snapshot is a position, not a period, so it is fetched without a range.
  const isSnapshot = !(ANALYTICS_SECTIONS as readonly string[]).includes(
    section,
  );

  const load = useCallback(() => {
    if (started.current) return;
    fetchFor(isSnapshot ? null : range);
  }, [fetchFor, isSnapshot, range]);

  const setRange = useCallback(
    (next: AnalyticsRange) => {
      setRangeState(next);
      fetchFor(next);
    },
    [fetchFor],
  );

  return { range, data, loading, error, setRange, load };
}
