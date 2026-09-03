// Session lifetime and permission freshness.
//
// Both numbers exist because the clinic runs one shared till. Whoever last used
// it is often not whoever is standing at it now, and access handed out to
// receive a single delivery has to be revocable before the boxes are unpacked.

// How long a session survives with no requests at all.
//
// This is an idle window, not a fixed lifetime. Auth.js re-encodes the JWT and
// re-sets the cookie on every session read (see the note in auth.config.ts), so
// the expiry slides forward the whole time someone is working and only runs out
// once the till goes quiet. A forgotten machine signs itself out; a long lunch
// does not.
export const SESSION_IDLE_SECONDS = 60 * 60;

// How long a role's permissions may be trusted before they are read back from
// the database. This bounds how long a revoked grant keeps working, and it is
// the only knob that decides how often the live lookup queries Postgres: at two
// minutes it is roughly 90k queries a month for ten users, independent of how
// much traffic they generate.
export const PERMISSION_TTL_MS = 2 * 60 * 1000;
