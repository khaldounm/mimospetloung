import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getAnalytics } from "@/lib/analytics";
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
  const data = await getAnalytics({ includeProfit, includePurchases });

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
        Expand a section to explore it. Profitability, purchases, revenue and
        bookings each have their own date range with quick presets; clients and
        inventory show the current snapshot.
      </Typography>
      <AnalyticsDashboard data={data} />
    </Box>
  );
}
