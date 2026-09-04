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

// There is deliberately no permission TTL any more. Role and permission reads
// are memoised per REQUEST in src/lib/session-user.ts, so a revoked grant stops
// working on the revoked person's very next request rather than up to two
// minutes later. The comment there explains the bug the old TTL caused.
