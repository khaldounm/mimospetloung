import { notFound, redirect } from "next/navigation";
import { ALL_CATEGORIES_SLUG } from "@/constants/running-cost";
import { parsePeriod, periodPath } from "@/utils/running-cost";

// A month with no category segment means every category.
export default async function RunningCostsMonthIndexPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const period = parsePeriod(year, month);
  if (!period) notFound();
  redirect(periodPath(period, ALL_CATEGORIES_SLUG));
}
