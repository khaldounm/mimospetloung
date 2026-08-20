"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/utils/api-client";
import type { ClientDTO } from "@/types/entities";

export interface ClientSearchResult {
  clientId: number;
  label: string;
  phone: string | null;
}

interface SearchState {
  options: ClientSearchResult[];
  loading: boolean;
}

// Debounce in ms. Long enough that typing a name is one request rather than
// one per keystroke, short enough that the list feels live at the counter.
const DEBOUNCE_MS = 250;

// Searches clients server-side as the user types. The client list is ~1,900
// rows and /api/clients is paged at 25, so it can never be loaded in full and
// filtered in the browser: the query has to go to the database, which already
// matches on name, email and both phone numbers.
//
// An empty query still fetches, so opening the field shows a starting page
// instead of an empty box. A request id guards against out-of-order responses
// when someone types quickly.
export function useClientSearch(query: string): SearchState {
  const [options, setOptions] = useState<ClientSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const requestId = ++latest.current;

    // The spinner starts when the debounce fires, not on every keystroke, so
    // the field does not flicker while a name is being typed.
    const timer = setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const params = new URLSearchParams();
          const q = query.trim();
          if (q) params.set("q", q);
          const data = await apiRequest<{ clients: ClientDTO[] }>(
            `/api/clients?${params}`,
          );
          if (requestId !== latest.current) return;
          setOptions(
            data.clients.map((c) => ({
              clientId: c.clientId,
              label: `${c.firstName} ${c.lastName}`.trim(),
              phone: c.phone,
            })),
          );
        } catch {
          // A failed lookup leaves the previous options in place; the field is
          // still usable and the next keystroke retries.
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
