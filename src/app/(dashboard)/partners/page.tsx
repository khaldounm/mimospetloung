import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPartnersWithStats } from "@/lib/partners";
import { defaultRange, rangeFromParams } from "@/utils/date-range";
import PartnersTable from "@/components/partners/PartnersTable";

// Balances change as items sell and payouts are recorded; always render fresh.
export const dynamic = "force-dynamic";

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "partners:write");

  // The range comes off the URL so a chosen period survives a reload and can be
  // linked to, falling back to the default when absent. The first paint is
  // seeded with it so no fetch is needed until the range is changed.
  const { from, to } = await searchParams;
  const range = rangeFromParams(from, to) ?? defaultRange();
  const partners = await getPartnersWithStats(range);

  return (
    <PartnersTable
      initialPartners={partners}
      initialRange={range}
      canWrite={canWrite}
    />
  );
}
