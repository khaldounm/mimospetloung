import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { runningCostInclude, toRunningCostDTO } from "@/lib/running-cost";
import RunningCostsTable from "@/components/running-costs/RunningCostsTable";

// Costs change as they are logged; always render the current list.
export const dynamic = "force-dynamic";

export default async function RunningCostsPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "costs:write");

  const costs = await prisma.runningCost.findMany({
    where: { deletedAt: null },
    include: runningCostInclude,
    orderBy: [{ incurredOn: "desc" }, { costId: "desc" }],
  });

  const initialCosts = costs.map(toRunningCostDTO);

  return <RunningCostsTable initialCosts={initialCosts} canWrite={canWrite} />;
}
