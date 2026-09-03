import { liveSession } from "@/lib/session-user";
import { hasPermission } from "@/lib/permissions";
import { listInvoices } from "@/lib/invoices";
import InvoicesTable from "@/components/invoices/InvoicesTable";

export default async function InvoicesPage() {
  const session = await liveSession();
  const canWrite = hasPermission(session?.user, "invoices:write");

  // Only the first page. Filtering, searching and paging all happen in SQL, and
  // the client list the create dialog needs is fetched when that dialog opens.
  const { invoices, total, pageSize } = await listInvoices({ page: 1 });

  return (
    <InvoicesTable
      initialInvoices={invoices}
      initialTotal={total}
      pageSize={pageSize}
      canWrite={canWrite}
    />
  );
}
