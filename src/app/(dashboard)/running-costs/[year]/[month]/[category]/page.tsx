import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listCostsForMonth } from "@/lib/running-cost";
import { ALL_CATEGORIES_SLUG } from "@/constants/running-cost";
import { parsePeriod } from "@/utils/running-cost";
import { categorySlug } from "@/utils/slug";
import RunningCostsMonth from "@/components/running-costs/RunningCostsMonth";

export const dynamic = "force-dynamic";

/**
 * One month of running costs, filtered to one category tab.
 *
 * The query is the whole month, not the tab: a month is bounded and small, and
 * loading it once means the tab strip, its per-category totals and the search
 * box are all served from memory. The category segment is applied on the client
 * for the same reason, which is why it needs no lookup here.
 */
export default async function RunningCostsCategoryPage({
  params,
}: {
  params: Promise<{ year: string; month: string; category: string }>;
}) {
  const { year, month, category } = await params;

  const period = parsePeriod(year, month);
  if (!period) notFound();
  // Reject anything that is not a slug this app would ever produce. A slug that
  // is well formed but unused is left alone: it is how a category tab survives
  // a move to a month that happens to have nothing under it.
  if (category !== ALL_CATEGORIES_SLUG && categorySlug(category) !== category) {
    notFound();
  }

  const session = await auth();
  const canWrite = hasPermission(session?.user, "costs:write");
  const costs = await listCostsForMonth(period);

  return (
    <RunningCostsMonth
      costs={costs}
      period={period}
      activeCategory={category}
      canWrite={canWrite}
    />
  );
}
