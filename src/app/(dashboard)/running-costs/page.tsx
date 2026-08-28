import { redirect } from "next/navigation";
import { listCostMonths } from "@/lib/running-cost";
import { defaultPeriod, periodPath } from "@/utils/running-cost";

// Bare /running-costs lands on the month worth opening: the current one when it
// has costs in it, otherwise the most recent one that does. The month list is
// the same cached query the layout uses, so this costs nothing extra.
export default async function RunningCostsIndexPage() {
  const months = await listCostMonths();
  redirect(periodPath(defaultPeriod(months)));
}
