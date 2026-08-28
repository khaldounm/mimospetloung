import { notFound, redirect } from "next/navigation";
import { listCostMonths } from "@/lib/running-cost";
import { MAX_COST_YEAR, MIN_COST_YEAR } from "@/constants/running-cost";
import { defaultPeriod, periodPath } from "@/utils/running-cost";

// A year on its own picks a month within it, so /running-costs/2025 is a link
// worth having rather than a dead end.
export default async function RunningCostsYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: segment } = await params;
  if (!/^\d{4}$/.test(segment)) notFound();
  const year = Number(segment);
  if (year < MIN_COST_YEAR || year > MAX_COST_YEAR) notFound();

  const months = await listCostMonths();
  redirect(periodPath(defaultPeriod(months, year)));
}
