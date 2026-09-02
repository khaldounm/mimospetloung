import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { defaultRange, resolvePreset } from "@/utils/date-range";
import { CLIENTS_DEFAULT_PRESET_ID } from "@/constants/analytics";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import AnalyticsGuide from "@/components/analytics/AnalyticsGuide";

// Always render fresh figures rather than caching the snapshot.
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth();
  // Net profit folds in running costs, which are admin-only (costs:read).
  const includeProfit = hasPermission(session?.user, "costs:read");
  // Purchases exposes what suppliers charge, so it follows orders:read.
  const includePurchases = hasPermission(session?.user, "orders:read");
  // No figures are computed here. Each section fetches its own the first time
  // someone opens it, which for most visits is none of them.
  //
  // Ranges are resolved on the server and passed down, so a section starts on
  // the same dates the markup was rendered with rather than on whatever the
  // browser's clock says a moment later.

  return (
    <Box>
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: "center", mb: 0.5 }}
      >
        <Typography variant="h4">Analytics</Typography>
        <AnalyticsGuide />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Expand a section to explore it. Every section has its own date range
        with quick presets, so one can be read over a year while another stays
        on this month.
      </Typography>
      <AnalyticsDashboard
        defaultRange={defaultRange()}
        clientsRange={resolvePreset(CLIENTS_DEFAULT_PRESET_ID)!}
        generatedAt={new Date().toISOString()}
        canSeeProfit={includeProfit}
        canSeePurchases={includePurchases}
      />
    </Box>
  );
}
