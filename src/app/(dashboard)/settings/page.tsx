import { getFxRate } from "@/lib/settings";
import ExchangeRateForm from "@/components/settings/ExchangeRateForm";

export default async function SettingsPage() {
  return <ExchangeRateForm initialRate={await getFxRate()} />;
}
