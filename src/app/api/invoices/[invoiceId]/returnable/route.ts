import { NextResponse } from "next/server";
import { ApiError, handle, requirePermission } from "@/lib/api";
import { listReturnable } from "@/lib/returns";

// What is still returnable on an already-issued invoice: each sale line, how
// much of it has come back, and the lot it should go back into. Read-only, so
// it sits behind invoices:read like every other invoice lookup.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    await requirePermission("invoices:read");
    const { invoiceId } = await params;
    const id = Number(invoiceId);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");

    return NextResponse.json({ invoice: await listReturnable(id) });
  });
}
