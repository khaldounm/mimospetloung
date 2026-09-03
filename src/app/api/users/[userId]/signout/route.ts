// Signs one person out of every device they are on, without touching whether
// their account is enabled. They can sign straight back in with the same
// password; what ends is every session that already exists.
//
// The mechanism is a timestamp rather than a session table: sessions are
// stateless JWTs, so there is nothing to delete. Stamping sessionsValidFrom
// makes every token minted before this instant fail the comparison in
// liveSession(), and the cookie is cleared the next time its owner touches the
// app. See src/lib/session-user.ts.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseId, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { invalidateLiveUser } from "@/lib/session-user";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("users:write");
    const { userId } = await params;
    const id = parseId(userId);

    const existing = await prisma.user.findUnique({
      where: { userId: id },
      select: { userId: true },
    });
    if (!existing) throw new ApiError(404, "User not found");

    // Deliberately allowed on yourself: the reason this exists is a till left
    // signed in, and the person realising it is usually the one who left it.
    // It ends the caller's own session too, which is the correct outcome.
    const signedOutAt = new Date();
    await prisma.user.update({
      where: { userId: id },
      data: { sessionsValidFrom: signedOutAt },
    });

    invalidateLiveUser(id);

    await writeAudit(session, {
      action: "signout",
      entity: "user",
      entityId: id,
      changes: { sessionsValidFrom: signedOutAt.toISOString() },
    });

    return NextResponse.json({ signedOutAt: signedOutAt.toISOString() });
  });
}
