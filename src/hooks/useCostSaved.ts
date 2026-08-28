"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { pathForSavedCost } from "@/utils/running-cost";
import type { RunningCostDTO } from "@/types/entities";

/**
 * What both entry points to the cost form do once a row is saved: follow it to
 * the month it was dated into, then refresh.
 *
 * The refresh is not optional even when the path does not change. The period
 * rail lives in a layout shared by every month, so a client navigation leaves
 * it exactly as it was fetched; only a refresh re-renders it, which is what
 * keeps the month totals in the rail honest after a row lands.
 */
export function useCostSaved(): (cost: RunningCostDTO) => void {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (cost: RunningCostDTO) => {
      const target = pathForSavedCost(cost, pathname);
      if (target !== pathname) router.push(target);
      router.refresh();
    },
    [router, pathname],
  );
}
