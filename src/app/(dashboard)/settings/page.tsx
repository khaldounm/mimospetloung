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
      <ExchangeRateForm initialRate={fxRate} />
      <PermissionMatrix initial={matrix} />
      <DeleteLogsCard />
    </Stack>
  );
}
