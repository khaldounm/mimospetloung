import { NextResponse } from "next/server";
import { ApiError, handle, requirePermission } from "@/lib/api";
import { getItemPerformance } from "@/lib/analytics";
import { itemPerformanceQuerySchema } from "@/schemas/analytics";

// How one item traded over a range. Billed figures only, so it needs nothing
// beyond analytics:read: cost and margin are not in the payload.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  return handle(async () => {
    await requirePermission("analytics:read");

    const { itemId } = await params;
    const search = new URL(request.url).searchParams;
    const parsed = itemPerformanceQuerySchema.safeParse({
      itemId,
      from: search.get("from"),
      to: search.get("to"),
    });
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid query",
      );
    }

    const { itemId: id, from, to } = parsed.data;
    const item = await getItemPerformance(id, { from, to });
    if (!item) throw new ApiError(404, "Item not found");

    return NextResponse.json({ range: { from, to }, item });
  });
}
