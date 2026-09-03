// Clears a session the database no longer honours.
//
// A deactivated account, a revoked permission or a forced sign-out all leave a
// perfectly valid cookie in the browser, and proxy.ts goes on trusting it
// because it runs on the Edge and cannot ask the database anything. So the
// dashboard layout, which does check, cannot simply redirect to /login: the
// proxy would see a signed-in user landing on an auth page and send them back
// to the dashboard, which sends them here again. Only a route handler can clear
// a cookie, so the layout sends them here.
//
// THIS ROUTE MUST ALWAYS CLEAR. It took production down on 2026-09-03: it used
// to refuse unless `Sec-Fetch-Site: same-origin`, meant to stop a drive-by
// logout URL. Opening the app from a bookmark or a typed address sends
// `Sec-Fetch-Site: none`, which failed that test, so the cookie survived and
// every user was stuck in /login -> /patients -> /api/account/signout -> /login
// forever. curl sends no such header at all, which is why local testing passed.
// A nuisance-grade logout CSRF is not worth a total outage. Do not reintroduce
// a condition around the clear.

import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

// Both names Auth.js may have written: the __Secure- prefix is used over https
// (production) and the bare name over http (local). Clearing whichever is not
// present is harmless, and it means the fix does not depend on signOut()
// resolving the prefix the same way under every deployment.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export async function GET(request: Request) {
  // ?signedout=1 is a circuit breaker read by proxy.ts, which will not bounce a
  // request carrying it away from /login. If the clear below ever fails again,
  // the user lands on the login screen instead of looping.
  const login = NextResponse.redirect(
    new URL("/login?signedout=1", request.url),
  );

  await signOut({ redirect: false });

  // Belt and braces on the response itself, so the outcome does not rest solely
  // on signOut()'s internals.
  for (const name of SESSION_COOKIES) {
    login.cookies.set(name, "", { path: "/", maxAge: 0 });
  }

  return login;
}
