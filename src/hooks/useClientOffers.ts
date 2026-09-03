"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/utils/api-client";
import type { OfferGrantDTO } from "@/types/entities";

interface ClientOffers {
  /** Every offer this client holds, spent ones included. */
  grants: OfferGrantDTO[];
  /** The single grant an invoice could spend right now, or null. */
  redeemable: OfferGrantDTO | null;
  loading: boolean;
  error: string | null;
  /** Refetch, after granting, revoking or redeeming one. */
  reload: () => void;
}

// Stable empty result, so a walk-in does not hand back a fresh array on every
// render and restart whatever is watching it.
const NONE: OfferGrantDTO[] = [];

// What has been fetched, tagged with the request it answers. The tag is what
// lets loading be derived rather than stored, the same shape useItemPerformance
// uses: anything the effect has not answered yet is in flight by definition, so
// switching client cannot leave the previous client's offers on screen looking
// settled.
interface Loaded {
  key: string;
  grants: OfferGrantDTO[];
  redeemable: OfferGrantDTO | null;
  error: string | null;
}

// What one client holds in the way of offers.
//
// The server decides which grant is redeemable rather than the browser, so
// expiry is worked out in one place and the invoice banner and the client page
// can never disagree about whether an offer is still good.
export function useClientOffers(clientId: number | null): ClientOffers {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // A walk-in belongs to no account, so there is nothing to hold an offer and
  // nothing to ask for. The tick is part of the key, which is what makes a
  // reload a different request rather than a no-op.
  const key = clientId == null ? null : `${clientId}:${tick}`;

  useEffect(() => {
    if (clientId == null || key == null) return;
    const requestId = ++latest.current;

    apiRequest<{ grants: OfferGrantDTO[]; redeemable: OfferGrantDTO | null }>(
      `/api/offers/grants?clientId=${clientId}`,
    )
      .then((res) => {
        if (requestId !== latest.current) return;
        setLoaded({
          key,
          grants: res.grants,
          redeemable: res.redeemable,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (requestId !== latest.current) return;
        setLoaded({
          key,
          grants: NONE,
          redeemable: null,
          error: err instanceof Error ? err.message : "Failed to load offers",
        });
      });
  }, [clientId, key]);

  const current = key != null && loaded?.key === key ? loaded : null;
  return {
    grants: current?.grants ?? NONE,
    redeemable: current?.redeemable ?? null,
    loading: key != null && current === null,
    error: current?.error ?? null,
    reload,
  };
}
