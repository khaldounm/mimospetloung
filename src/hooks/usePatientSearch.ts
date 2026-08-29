"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/utils/api-client";
import type { PatientDTO } from "@/types/entities";

export interface PatientSearchResult {
  patientId: number;
  clientId: number;
  /** "Milo (Sarah Haddad)", the same shape the preloaded list used to carry. */
  label: string;
  species: string | null;
}

interface SearchState {
  options: PatientSearchResult[];
  loading: boolean;
}

// Debounce in ms, matching the client and item pickers.
const DEBOUNCE_MS = 250;

// Searches pets server-side as the user types. There are ~1,400 of them and
// /api/patients is paged at 25, so the browser cannot hold the list and filter
// it: the query goes to the database, which already matches on the pet's name
// and the owner's, the pairing staff are actually given at the counter.
//
// An empty query still fetches, so opening the field shows a starting page
// instead of an empty box. A request id guards against out-of-order responses
// when someone types quickly.
export function usePatientSearch(query: string): SearchState {
  const [options, setOptions] = useState<PatientSearchResult[]>([]);
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
          const data = await apiRequest<{ patients: PatientDTO[] }>(
            `/api/patients?${params}`,
          );
          if (requestId !== latest.current) return;
          setOptions(
            data.patients.map((p) => ({
              patientId: p.patientId,
              clientId: p.clientId,
              label: `${p.name} (${p.clientName})`,
              species: p.species,
            })),
          );
        } catch {
          // A failed lookup leaves the field usable; the next keystroke retries.
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
