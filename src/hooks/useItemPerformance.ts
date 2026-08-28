"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/utils/api-client";
import type { AnalyticsRange, ItemPerformanceDetail } from "@/types/entities";

interface PerformanceState {
  data: ItemPerformanceDetail | null;
  loading: boolean;
  error: string | null;
}

// What has actually been fetched, tagged with the request it answers. Keeping
// the tag alongside the payload is what lets loading be derived rather than
// stored: anything the effect has not answered yet is, by definition, in flight,
// so switching item or range cannot leave a stale row on screen looking settled.
interface Loaded {
  key: string;
  data: ItemPerformanceDetail | null;
  error: string | null;
}

function requestKey(itemId: number, range: AnalyticsRange): string {
  return `${itemId}:${range.from}:${range.to}`;
}

// Fetches one item's figures for the section's current range. Refetches when
// either changes, so moving the date range re-reads the item already on screen
// rather than clearing it. A request id guards against out-of-order responses
// when the item is switched quickly.
export function useItemPerformance(
  itemId: number | null,
  range: AnalyticsRange,
): PerformanceState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const latest = useRef(0);

  const key = itemId == null ? null : requestKey(itemId, range);

  useEffect(() => {
    if (itemId == null || key == null) return;
    const requestId = ++latest.current;

    const query = new URLSearchParams({ from: range.from, to: range.to });
    apiRequest<{ item: ItemPerformanceDetail }>(
      `/api/analytics/items/${itemId}?${query}`,
    )
      .then((res) => {
        if (requestId === latest.current) {
          setLoaded({ key, data: res.item, error: null });
        }
      })
      .catch((err: unknown) => {
        if (requestId !== latest.current) return;
        setLoaded({
          key,
          data: null,
          error: err instanceof Error ? err.message : "Failed to load",
        });
      });
  }, [itemId, key, range.from, range.to]);

  const current = key != null && loaded?.key === key ? loaded : null;
  return {
    data: current?.data ?? null,
    loading: key != null && current === null,
    error: current?.error ?? null,
  };
}
