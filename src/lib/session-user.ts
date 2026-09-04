// Live role and permission lookup, sitting between Auth.js and every guard.
//
// The JWT carries a copy of the user's role and permissions taken at sign-in and
// nothing ever re-reads it, so a role change or a deactivation would otherwise
// sit unnoticed inside a signed cookie until that person happened to sign in
// again. On a shared till that is the wrong default: access gets handed out for
// one delivery and taken back the same afternoon.
//
// The split this file introduces: the token stays the *identity* (which user is
// this), the database becomes the *authority* (what may they do). The read is
// memoised for the life of ONE request, so a render that asks several times
// pays for a single query and nothing survives to go stale between requests.
//
// proxy.ts still gates paths on the token, because it runs on the Edge and
// cannot reach Postgres. It is therefore a navigation convenience, not the
// security boundary: a user whose role was just narrowed can still reach a page
// shell, but every guard below fetches live and returns 403 or empty data.

import { cache } from "react";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface LiveUser {
  roleName: string;
  permissions: string[];
  firstName: string;
  lastName: string;
  // Internal to this module: compared against the token's stamp, never copied
  // onto the session handed back to callers.
  sessionsValidFrom: Date | null;
}

// The live answer for one user, memoised for the life of a single request.
//
// THERE IS DELIBERATELY NO CROSS-REQUEST CACHE. There used to be: a module-level
// map with a two-minute TTL, plus invalidateLiveUser() called wherever a role
// changed. It was wrong in two compounding ways, and the second one handed out
// access that had already been taken away.
//
// First, Next.js gives route handlers and server components SEPARATE module
// instances, so they held separate maps. A demote runs in a route handler, so
// the invalidation cleared that copy and left the server-component copy warm
// with the old permissions.
//
// Second, and worse: liveSession() only re-read the database when the token and
// the cached set DISAGREED. After a demote the stale cache still said
// "promoted" and so did the token, so they agreed, the re-read never ran, and
// the session came back carrying the stale permissions for hasPermission() to
// say yes to. Reported from the clinic on 2026-09-05: demoted in one browser,
// still fully promoted in the other until the page was refreshed.
//
// Request scope removes the window rather than shortening it. React's cache()
// memoises per request and starts empty on the next one, so the answer can
// never predate the token it is compared against, and there is nothing to
// invalidate from anywhere else. Where no request scope exists cache() simply
// calls through, which costs a query and is still correct.
//
// The price is about one ~2ms in-region query per request instead of one per
// user per two minutes per instance. At clinic volume that is single-digit
// seconds of database time a month.
//
// Do not reintroduce a cross-request cache here without a SHARED store. A
// per-instance one cannot be invalidated across instances and this is the file
// where being stale means being wrong about who may do what.
export const readLiveUser = cache(async function readLiveUser(
  userId: number,
): Promise<LiveUser | null> {
  const row = await prisma.user.findUnique({
    where: { userId },
    // Names only. This runs often, so it pulls the handful of permission
    // strings the guards actually compare against and nothing else.
    select: {
      isActive: true,
      firstName: true,
      lastName: true,
      sessionsValidFrom: true,
      role: {
        select: {
          name: true,
          rolePermissions: {
            select: { permission: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!row || !row.isActive) return null;

  return {
    roleName: row.role.name,
    permissions: row.role.rolePermissions.map((rp) => rp.permission.name),
    firstName: row.firstName,
    lastName: row.lastName,
    sessionsValidFrom: row.sessionsValidFrom,
  };
});

// Whether an admin has signed this session out since it began.
//
// Compared against the stamp the jwt callback wrote at sign-in, NEVER against
// the token's `iat`: Auth.js calls setIssuedAt() on every re-encode, which
// happens on every request, so `iat` is always "just now" and would never look
// stale. A token carrying no stamp predates the feature and cannot prove when it
// began, so a revocation wins and it has to sign in again.
// Whether the role's permissions have changed since this token was minted.
//
// The token carries a copy of the permissions taken at sign-in, and proxy.ts
// gates the module routes on that copy because it runs on the Edge and cannot
// reach the database. Letting the copy drift from the database is what creates
// every awkward case: a granted permission is invisible to the gate and the
// request is refused before any live check runs, and a revoked one is still
// claimed, so the gate waves the request through to a page whose own data call
// then comes back 403 and leaves a broken table on screen.
//
// So the two are simply never allowed to disagree. Any difference in either
// direction ends the session; signing in again mints a token that matches. It
// costs one interruption at the moment an admin changes someone's access, which
// is when it is expected and easy to explain, and in exchange the proxy, the
// pages and the handlers can never reach different conclusions.
//
// The live set is read fresh per request, so there is no window in which one
// instance holds an older answer than another and no way for this comparison to
// be made against something that predates the token. A difference here is a
// real difference.
function permissionsChanged(
  tokenPermissions: string[] | undefined,
  livePermissions: string[],
): boolean {
  const held = new Set(tokenPermissions ?? []);
  if (held.size !== livePermissions.length) return true;
  return livePermissions.some((p) => !held.has(p));
}

function isSignedOut(
  validFrom: Date | null,
  signedInAt: number | undefined,
): boolean {
  if (!validFrom) return false;
  if (typeof signedInAt !== "number") return true;
  return signedInAt < validFrom.getTime();
}

// The session every server-side caller should use: Auth.js for identity, the
// database for authority.
//
// Returns null on any of four counts: no session at all, the account behind a
// still-valid cookie has been deactivated, an admin has signed that account out
// of everything since this session began, or the role has since been granted a
// permission the token does not carry. Every one is handled the same way
// upstream, by clearing the cookie and sending them to sign in.
export async function liveSession(): Promise<Session | null> {
  const session = await auth();
  if (!session?.user) return null;

  // Tokens are long-lived and this field is what the whole lookup keys on, so
  // an older or malformed one is treated as no session rather than trusted.
  const userId = session.user.userId;
  if (typeof userId !== "number") return null;

  const live = await readLiveUser(userId);
  if (!live) return null;

  // This used to re-read the database before believing a disagreement, because
  // a cached set could be older than the token: signing in reads the database
  // directly, so a token minted a second ago disagreed with anything cached
  // before the change that prompted it, and ending the session on that reading
  // locked people out of a sign-in they had just completed correctly. That
  // second read is gone because its cause is gone. The read above happens
  // inside this request and therefore always after the token was minted, so a
  // disagreement can only mean the database has since changed. Restoring a
  // cross-request cache would bring the false positive back with it.

  if (permissionsChanged(session.user.permissions, live.permissions)) {
    return null;
  }

  // sessionsValidFrom is this module's business, not the caller's, so it is
  // peeled off rather than spread onto session.user.
  const { sessionsValidFrom, ...fields } = live;
  if (isSignedOut(sessionsValidFrom, session.user.signedInAt)) return null;

  return { ...session, user: { ...session.user, ...fields } };
}
