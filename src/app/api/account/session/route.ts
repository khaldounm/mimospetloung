import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/api";

// "Is this session still real?" and nothing else.
//
// The cheapest question the app can ask: no body, no query beyond the one
// liveSession() already runs, no audit entry. It exists so the client has
// something to ask on navigation and on regaining focus, because the server
// cannot eject anyone on its own. See src/hooks/useSessionWatch.ts for why the
// client has to be the one asking.
//
// The answer that matters is the 401, which requireSession() throws when the
// account is gone, deactivated, force signed out, or holding permissions that
// no longer match the database. apiRequest turns that into the hard navigation
// to /api/account/signout that actually clears the cookie.
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireSession();
    return new NextResponse(null, { status: 204 });
  });
}
