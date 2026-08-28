"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/utils/api-client";
import type { ItemSearchResult } from "@/types/entities";

interface SearchState {
  options: ItemSearchResult[];
  loading: boolean;
}

// Debounce in ms, matching the client picker: one request per typed word rather
// than one per keystroke, still fast enough to feel live.
const DEBOUNCE_MS = 250;

// Type-to-search over the stock catalogue, matched server-side on name, category
// and barcode (primary and alternate codes both). The search has to go to the
// database: the catalogue is far larger than any page the browser holds, and a
// scanned code is not text the user could have typed a prefix of.
//
// An empty query still fetches, so opening the field offers a starting page
// instead of a blank box. A request id guards against out-of-order responses.
export function useItemSearch(query: string): SearchState {
  const [options, setOptions] = useState<ItemSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const requestId = ++latest.current;

    const timer = setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const params = new URLSearchParams();
          const q = query.trim();
          if (q) params.set("q", q);
          const data = await apiRequest<{ items: ItemSearchResult[] }>(
            `/api/analytics/items?${params}`,
          );
          if (requestId !== latest.current) return;
          setOptions(data.items);
        } catch {
          // A failed lookup empties the list but leaves the field usable; the
          // next keystroke retries.
          if (requestId === latest.current) setOptions([]);
        } finally {
          if (requestId === latest.current) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return { options, loading };
}
