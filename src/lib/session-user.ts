// Live role and permission lookup, sitting between Auth.js and every guard.
//
// The JWT carries a copy of the user's role and permissions taken at sign-in and
// nothing ever re-reads it, so a role change or a deactivation would otherwise
// sit unnoticed inside a signed cookie until that person happened to sign in
// again. On a shared till that is the wrong default: access gets handed out for
// one delivery and taken back the same afternoon.
//
// The split this file introduces: the token stays the *identity* (which user is
// this), the database becomes the *authority* (what may they do). Reads are
// cached per warm instance for PERMISSION_TTL_MS, which is what keeps it from
// becoming a query per request.
//
// proxy.ts still gates paths on the token, because it runs on the Edge and
// cannot reach Postgres. It is therefore a navigation convenience, not the
// security boundary: a user whose role was just narrowed can still reach a page
// shell, but every guard below fetches live and returns 403 or empty data.

import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSION_TTL_MS } from "@/constants/session";

export interface LiveUser {
  roleName: string;
  permissions: string[];
  firstName: string;
  lastName: string;
  // Internal to this module: compared against the token's stamp, never copied
  // onto the session handed back to callers.
  sessionsValidFrom: Date | null;
}

interface Entry {
  // null means "no longer allowed in": the row is gone, or isActive is false.
  // Cached like any other answer so a deactivated account cannot turn each
  // request it keeps making into another round trip.
  user: LiveUser | null;
  expiresAt: number;
}

// Module scope, so it lives as long as the warm instance and dies with it.
// Bounded by headcount, so it needs no eviction policy beyond the TTL.
const entries = new Map<number, Entry>();

// Collapses concurrent misses for one user into a single query. A page load
// fires several requests at once, and without this each would independently
// notice the entry had gone stale and go to the database.
const inFlight = new Map<number, Promise<LiveUser | null>>();

async function read(userId: number): Promise<LiveUser | null> {
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
}

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
// Bounded staleness caveat: the live set is read through a per-instance cache,
// so during the TTL window one instance can hold an older set than another. A
// person moving between them around a permission change can be signed out more
// than once before it settles. It self-heals within PERMISSION_TTL_MS.
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

export async function readLiveUser(userId: number): Promise<LiveUser | null> {
  const cached = entries.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const pending = inFlight.get(userId);
  if (pending) return pending;

  // A rejection propagates to the caller and surfaces as a 500, the same as any
  // other query in the request would when Postgres is unreachable. Nothing is
  // cached on failure, so the next request retries rather than inheriting it.
  const promise = read(userId)
    .then((user) => {
      entries.set(userId, { user, expiresAt: Date.now() + PERMISSION_TTL_MS });
      return user;
    })
    .finally(() => {
      inFlight.delete(userId);
    });

  inFlight.set(userId, promise);
  return promise;
}

// Drops a cached entry so the next request re-reads. Called wherever a role or
// isActive changes, which makes a revoke land at once on the instance that
// served the change. Other instances still wait out the TTL, so treat this as a
// courtesy that shortens the common case, never as the guarantee.
export function invalidateLiveUser(userId: number): void {
  entries.delete(userId);
}

// Drops the cached entry and reads again. Used when a cached answer contradicts
// the token in front of it, where the cache is the more likely thing to be
// wrong: a sign-in reads the database directly, so a token minted seconds ago
// can legitimately disagree with an entry cached before the change.
export async function refreshLiveUser(
  userId: number,
): Promise<LiveUser | null> {
  entries.delete(userId);
  return readLiveUser(userId);
}

// Same courtesy for a change that moves everybody at once: toggling a permission
// on a role rewrites what every user holding it may do, and the cache is keyed
// by user, so there is nothing finer to invalidate and nothing worth the code to
// work out who was affected. The map holds one entry per signed-in member of
// staff, so clearing it costs a handful of re-reads.
export function invalidateAllLiveUsers(): void {
  entries.clear();
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

  let live = await readLiveUser(userId);
  if (!live) return null;

  // A disagreement is not enough on its own. The cached set can simply be older
  // than the token it is being compared against: signing in reads the database
  // directly, so a token minted a second ago will disagree with anything cached
  // before the change that prompted it. Ending the session on that reading locks
  // the person out of a sign-in they just completed correctly, and every retry
  // does it again until the entry expires. So confirm against the database
  // before believing it.
  if (permissionsChanged(session.user.permissions, live.permissions)) {
    live = await refreshLiveUser(userId);
    if (!live) return null;
    if (permissionsChanged(session.user.permissions, live.permissions)) {
      return null;
    }
  }

  // sessionsValidFrom is this module's business, not the caller's, so it is
  // peeled off rather than spread onto session.user. Read from whichever copy
  // survived above, so a refresh is reflected here too.
  const { sessionsValidFrom, ...fields } = live;
  if (isSignedOut(sessionsValidFrom, session.user.signedInAt)) return null;

  return { ...session, user: { ...session.user, ...fields } };
}
