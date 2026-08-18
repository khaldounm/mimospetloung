"use client";

import { useRef, useState } from "react";
import { apiRequest } from "@/utils/api-client";
import type { AnalyticsRange } from "@/types/entities";
import type { AnalyticsSection } from "@/schemas/analytics";

interface SectionState<T> {
  range: AnalyticsRange;
  data: T;
  loading: boolean;
  error: string | null;
  setRange: (next: AnalyticsRange) => void;
}

// Owns one time-boxable section's range and data. Seeded with the server-rendered
// initial data (for the default range), so the first paint needs no fetch; it
// only calls the API when the user picks a new range. A request id guards against
// out-of-order responses when the range is changed rapidly.
export function useAnalyticsSection<T>(
  section: AnalyticsSection,
  initialData: T,
  initialRange: AnalyticsRange,
): SectionState<T> {
  const [range, setRangeState] = useState(initialRange);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  function setRange(next: AnalyticsRange): void {
    setRangeState(next);
    const requestId = ++latest.current;
    setLoading(true);
    setError(null);

    const query = new URLSearchParams({
      section,
      from: next.from,
      to: next.to,
    });
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
  }

  return { range, data, loading, error, setRange };
}
