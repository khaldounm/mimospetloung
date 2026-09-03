import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getFxRate } from "@/lib/settings";
import { getPermissionMatrix } from "@/lib/rbac";
import { listOffers } from "@/lib/offers";
import ExchangeRateForm from "@/components/settings/ExchangeRateForm";
import PermissionMatrix from "@/components/settings/PermissionMatrix";
import DeleteLogsCard from "@/components/settings/DeleteLogsCard";
import OffersCard from "@/components/settings/OffersCard";

export default async function SettingsPage() {
  const [fxRate, matrix, offers] = await Promise.all([
    getFxRate(),
    getPermissionMatrix(),
    // Retired and expired offers included: this is the page where they are
    // brought back, so hiding them would leave no way to.
    listOffers(true),
  ]);

  return (
    <Stack spacing={4}>
      <Typography variant="h4">Settings</Typography>

      {/* The three small cards share a row and stretch to the same height; the
          matrix takes the full width underneath, because it needs every pixel
          it can get before it starts scrolling sideways. One column on a phone
          and two on a tablet, where three side by side would leave none of them
          readable. The danger zone stays last, furthest from the controls
          people actually use. */}
      <Box
        sx={{
          display: "grid",
          gap: 4,
          gridTemplateColumns: {
            xs: "1fr",
            md: "1fr 1fr",
            lg: "repeat(3, 1fr)",
          },
        }}
      >
        <ExchangeRateForm initialRate={fxRate} />
        <OffersCard initialOffers={offers} />
        <DeleteLogsCard />
      </Box>

      <PermissionMatrix initial={matrix} />
    </Stack>
  );
}
