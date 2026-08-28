import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/utils/format";
import { monthBounds, type CostPeriod } from "@/utils/running-cost";
import type { CostMonthDTO, RunningCostDTO } from "@/types/entities";

// Include the creator so the list can show who logged each cost.
export const runningCostInclude = {
  creator: { select: { firstName: true, lastName: true } },
} as const;

type RunningCostRow = Prisma.RunningCostGetPayload<{
  include: typeof runningCostInclude;
}>;

export function toRunningCostDTO(c: RunningCostRow): RunningCostDTO {
  return {
    costId: c.costId,
    category: c.category,
    description: c.description,
    amount: c.amount.toString(),
    incurredOn: toDateOnly(c.incurredOn) ?? "",
    notes: c.notes,
    createdByName: c.creator
      ? `${c.creator.firstName} ${c.creator.lastName}`
      : null,
    createdAt: c.createdAt.toISOString(),
  };
}

/**
 * Every calendar month that has costs logged, newest first, with what each one
 * came to.
 *
 * One grouped query over a date-only column rather than reading the rows and
 * bucketing them in JS: the result is a handful of rows per year of trading no
 * matter how big the ledger gets, which is what lets the period rail be built
 * once in the layout and then sit still while the months below it change.
 *
 * Casts are deliberate. EXTRACT returns numeric and count(*) returns int8, both
 * of which reach the driver as something other than a plain number; ::int makes
 * them numbers, and summing to ::text keeps the money exact instead of routing a
 * Decimal through a float.
 *
 * Wrapped in cache() so the layout that draws the rail and the index route that
 * redirects off the same list share one query per request instead of two.
 */
export const listCostMonths = cache(async (): Promise<CostMonthDTO[]> => {
  const rows = await prisma.$queryRaw<
    { year: number; month: number; total: string; count: number }[]
  >`
    SELECT extract(year FROM incurred_on)::int  AS year,
           extract(month FROM incurred_on)::int AS month,
           sum(amount)::text                    AS total,
           count(*)::int                        AS count
    FROM running_costs
    WHERE deleted_at IS NULL
    GROUP BY 1, 2
    ORDER BY 1 DESC, 2 DESC`;

  // Postgres months are 1-12; the rest of the app indexes them like Date does.
  return rows.map((r) => ({
    year: r.year,
    month: r.month - 1,
    total: r.total,
    count: r.count,
  }));
});

/**
 * Every cost in one calendar month, newest first.
 *
 * The whole month is the unit of work on purpose. It is bounded (a clinic logs
 * costs in the tens per month, not the thousands), it rides the incurred_on
 * index, and it is enough to derive the category tabs, their totals and the
 * month total without a second query. Switching tabs then filters what the page
 * already holds instead of asking the database again.
 */
export async function listCostsForMonth(
  period: CostPeriod,
): Promise<RunningCostDTO[]> {
  const { from, toExclusive } = monthBounds(period);
  const costs = await prisma.runningCost.findMany({
    where: { deletedAt: null, incurredOn: { gte: from, lt: toExclusive } },
    include: runningCostInclude,
    orderBy: [{ incurredOn: "desc" }, { costId: "desc" }],
  });
  return costs.map(toRunningCostDTO);
}
