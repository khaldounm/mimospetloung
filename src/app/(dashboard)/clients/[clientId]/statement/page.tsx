import { notFound } from "next/navigation";
import { liveSession } from "@/lib/session-user";
import { hasPermission } from "@/lib/permissions";
import { getClientStatement } from "@/lib/client-statement";
import { getFxRate } from "@/lib/settings";
import { rangeFromParams } from "@/utils/date-range";
import ClientStatement from "@/components/clients/ClientStatement";

// A statement is a point-in-time record, so it is always rendered fresh rather
// than served from a cache that might predate a payment taken a minute ago.
export const dynamic = "force-dynamic";

export default async function ClientStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  // The period lives in the URL so a statement can be linked to, reloaded, or
  // cited in a dispute and come back with the same figures. No period means the
  // whole account, which is what someone asking "why do I owe this?" needs.
  const { from, to } = await searchParams;
  const range = rangeFromParams(from, to);

  const session = await liveSession();
  const [statement, fxRate] = await Promise.all([
    getClientStatement(id, range),
    getFxRate(),
  ]);
  if (!statement) notFound();

  return (
    <ClientStatement
      statement={statement}
      fxRate={fxRate}
      // Taking money is its own permission, the same one the client page and
      // the invoice payment button are gated on.
      canPay={hasPermission(session?.user, "payments:write")}
      canSend={hasPermission(session?.user, "notifications:write")}
      // Row links go to the invoice module, which not everyone who may read a
      // client can open. Without this the statement hands out dead links.
      canOpenInvoices={hasPermission(session?.user, "invoices:read")}
    />
  );
}
