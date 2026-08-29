import { NextResponse } from "next/server";
import { handle, parseId, requirePermission } from "@/lib/api";
import { getSupplierOrders } from "@/lib/suppliers";

// One page of a supplier's orders, for the pager on the supplier page. The
// first page comes down with the document; this serves every page after it.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  return handle(async () => {
    await requirePermission("orders:read");
    const supplierId = parseId((await params).supplierId, "supplier id");

    const pageRaw = new URL(request.url).searchParams.get("page")?.trim();
    const page = await getSupplierOrders(
      supplierId,
      pageRaw ? Number(pageRaw) : 1,
    );

    return NextResponse.json(page);
  });
}
