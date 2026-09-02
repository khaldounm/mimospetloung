import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getFxRate } from "@/lib/settings";
import { getPermissionMatrix } from "@/lib/rbac";
import ExchangeRateForm from "@/components/settings/ExchangeRateForm";
import PermissionMatrix from "@/components/settings/PermissionMatrix";
import DeleteLogsCard from "@/components/settings/DeleteLogsCard";

export default async function SettingsPage() {
  const [fxRate, matrix] = await Promise.all([
    getFxRate(),
    getPermissionMatrix(),
  ]);

  return (
    <Stack spacing={4}>
      <Typography variant="h4">Settings</Typography>

      {/* The two small cards share a row and stretch to the same height; the
          matrix takes the full width underneath, because it needs every pixel
          it can get before it starts scrolling sideways. One column on a
          phone, where side by side would leave neither card readable. */}
      <Box
        sx={{
          display: "grid",
          gap: 4,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <ExchangeRateForm initialRate={fxRate} />
        <DeleteLogsCard />
      </Box>

      <PermissionMatrix initial={matrix} />
    </Stack>
  );
}
