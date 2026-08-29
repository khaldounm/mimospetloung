import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getFxRate } from "@/lib/settings";
import ExchangeRateForm from "@/components/settings/ExchangeRateForm";
import DeleteLogsCard from "@/components/settings/DeleteLogsCard";

export default async function SettingsPage() {
  return (
    <Stack spacing={4}>
      <Typography variant="h4">Settings</Typography>
      <ExchangeRateForm initialRate={await getFxRate()} />
      <DeleteLogsCard />
    </Stack>
  );
}
