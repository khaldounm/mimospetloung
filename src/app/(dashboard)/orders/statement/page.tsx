import { getStatement } from "@/lib/statement";
import { defaultRange, rangeFromParams } from "@/utils/date-range";
import SupplierStatement from "@/components/orders/SupplierStatement";

// A statement is a point-in-time record, so it is always rendered fresh rather
// than served from a cache that might predate a payment.
export const dynamic = "force-dynamic";

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  // The period lives in the URL so a statement can be linked to, reloaded, or
  // cited in an audit trail and come back with the same figures.
  const { from, to } = await searchParams;
  const range = rangeFromParams(from, to) ?? defaultRange();

  const statement = await getStatement(range);

  return <SupplierStatement statement={statement} />;
}
