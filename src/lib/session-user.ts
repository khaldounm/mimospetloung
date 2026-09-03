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
// Returns null on any of three counts: no session at all, the account behind a
// still-valid cookie has been deactivated, or an admin has signed that account
// out of everything since this particular session began. Every one of them is
// handled the same way upstream, by clearing the cookie.
export async function liveSession(): Promise<Session | null> {
  const session = await auth();
  if (!session?.user) return null;

  // Tokens are long-lived and this field is what the whole lookup keys on, so
  // an older or malformed one is treated as no session rather than trusted.
  const userId = session.user.userId;
  if (typeof userId !== "number") return null;

  const live = await readLiveUser(userId);
  if (!live) return null;

  // sessionsValidFrom is this module's business, not the caller's, so it is
  // peeled off rather than spread onto session.user.
  const { sessionsValidFrom, ...fields } = live;
  if (isSignedOut(sessionsValidFrom, session.user.signedInAt)) return null;

  return { ...session, user: { ...session.user, ...fields } };
}
