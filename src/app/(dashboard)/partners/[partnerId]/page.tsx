import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPartnerDetail } from "@/lib/partners";
import { defaultRange, rangeFromParams } from "@/utils/date-range";
import PartnerDetail from "@/components/partners/PartnerDetail";

export const dynamic = "force-dynamic";

export default async function PartnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { partnerId } = await params;
  const id = Number(partnerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await auth();
  const canWrite = hasPermission(session?.user, "partners:write");

  // Carried in from the list's link so clicking a partner keeps the period the
  // figures were being read at, rather than resetting to the default and showing
  // a different one under the same heading.
  const { from, to } = await searchParams;
  const range = rangeFromParams(from, to) ?? defaultRange();
  const detail = await getPartnerDetail(id, range);
  if (!detail) notFound();

  return (
    <PartnerDetail
      partner={detail.partner}
      itemPerformance={detail.itemPerformance}
      earnings={detail.earnings}
      payouts={detail.payouts}
      initialRange={range}
      canWrite={canWrite}
    />
  );
}
