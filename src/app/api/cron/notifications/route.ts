import { NextResponse } from "next/server";
import { ApiError, handle } from "@/lib/api";
import { processPendingNotifications } from "@/lib/notifications";

// Authorize via the shared CRON_SECRET (Vercel Cron sends it as a Bearer token).
// This route is not session-gated, so the secret is the only gate.
function assertCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    throw new ApiError(401, "Unauthorized");
  }
}

async function run(request: Request) {
  return handle(async () => {
    assertCron(request);
    const result = await processPendingNotifications();
    return NextResponse.json(result);
  });
}

// Vercel Cron issues GET; allow POST too for manual triggering.
export const GET = run;
export const POST = run;
