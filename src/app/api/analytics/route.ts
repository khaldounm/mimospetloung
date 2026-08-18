import { NextResponse } from "next/server";
import { ApiError, handle, requirePermission } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { getAnalyticsSection } from "@/lib/analytics";
import { analyticsSectionQuerySchema } from "@/schemas/analytics";

// Re-queries a single time-boxable analytics section for a custom date range.
// The dashboard calls this when the user changes a section's calendar.
export async function GET(request: Request) {
  return handle(async () => {
    const session = await requirePermission("analytics:read");

    const params = new URL(request.url).searchParams;
    const parsed = analyticsSectionQuerySchema.safeParse({
      section: params.get("section"),
      from: params.get("from"),
      to: params.get("to"),
    });
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid query",
      );
    }
    const { section, from, to } = parsed.data;

    // Net profit folds in running costs, which are gated by costs:read.
    if (section === "profit" && !hasPermission(session.user, "costs:read")) {
      throw new ApiError(403, "Forbidden");
    }
    // Purchases exposes what the clinic pays suppliers, so it follows the
    // purchasing permission rather than analytics:read alone.
    if (
      section === "purchases" &&
      !hasPermission(session.user, "orders:read")
    ) {
      throw new ApiError(403, "Forbidden");
    }

    const data = await getAnalyticsSection(section, { from, to });
    return NextResponse.json({ section, range: { from, to }, data });
  });
}
