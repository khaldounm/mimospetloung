"use client";

import { useRef } from "react";

/**
 * Serialise writes that all rewrite the same thing.
 *
 * Every invoice write answers with the whole recomputed invoice, so two in
 * flight at once race and the slower response lands last, quietly undoing the
 * newer one. Queuing keeps the interface free (the edit is accepted straight
 * away) while the server stays the single source of truth for what is on the
 * document.
 *
 * The queue survives a failed link: one rejected write must not stop every
 * write made after it.
 */
export function useWriteQueue(): (task: () => Promise<void>) => void {
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  return (task) => {
    chain.current = chain.current.then(task).catch(() => undefined);
  };
}
