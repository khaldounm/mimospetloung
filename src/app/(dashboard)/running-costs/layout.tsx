import { Box } from "@mui/material";
import { liveSession } from "@/lib/session-user";
import { hasPermission } from "@/lib/permissions";
import { listCostMonths } from "@/lib/running-cost";
import RunningCostsHeader from "@/components/running-costs/RunningCostsHeader";

// Costs change as they are logged; always render the current list.
export const dynamic = "force-dynamic";

/**
 * Shell for every running-costs route: the title, the New cost button and the
 * period rail.
 *
 * Sitting above the year and month segments is the point. Moving between months
 * or categories re-renders only the list underneath, so the rail is built from
 * one grouped query per visit rather than once per click.
 */
export default async function RunningCostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, months] = await Promise.all([
    liveSession(),
    listCostMonths(),
  ]);
  const canWrite = hasPermission(session?.user, "costs:write");

  return (
    <Box>
      <RunningCostsHeader months={months} canWrite={canWrite} />
      {children}
    </Box>
  );
}
