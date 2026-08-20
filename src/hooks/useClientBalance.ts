"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/utils/api-client";
import type { ClientDTO } from "@/types/entities";

// Fetches one client's account balance. Kept off the list endpoint on purpose:
// listClients does not return money, and the balance is only wanted for the one
// client actually selected. Null while loading, unknown, or when no client is
// selected (a walk-in has no account).
//
// The fetched value is stored alongside the id it belongs to, so switching
// clients reads as "not loaded yet" without an effect writing state to clear
// it, and a stale balance can never be shown against the wrong client.
export function useClientBalance(clientId: number | null): string | null {
  const [entry, setEntry] = useState<{
    clientId: number;
    balance: string | null;
  } | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    if (clientId == null) return;
    const requestId = ++latest.current;
    void (async () => {
      try {
        const data = await apiRequest<{ client: ClientDTO }>(
          `/api/clients/${clientId}`,
        );
        if (requestId !== latest.current) return;
        setEntry({ clientId, balance: data.client.accountBalance ?? null });
      } catch {
        if (requestId === latest.current) setEntry({ clientId, balance: null });
      }
    })();
  }, [clientId]);

  if (clientId == null) return null;
  return entry?.clientId === clientId ? entry.balance : null;
}
