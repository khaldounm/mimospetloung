import { NextResponse } from "next/server";
import { ApiError, handle, requirePermission } from "@/lib/api";
import { searchAnalyticsItems } from "@/lib/analytics";
import { itemSearchQuerySchema } from "@/schemas/analytics";

// Predictive search behind the By item picker. Kept under /api/analytics rather
// than reusing /api/inventory so the section works for a user who may read
// reports but not the stock list: it returns names and codes, never cost.
export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("analytics:read");

    const params = new URL(request.url).searchParams;
    const parsed = itemSearchQuerySchema.safeParse({
      q: params.get("q") ?? undefined,
    });
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid query",
      );
    }

    const items = await searchAnalyticsItems(parsed.data.q ?? "");
    return NextResponse.json({ items });
  });
}
