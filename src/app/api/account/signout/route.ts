// Clears a session the database no longer honours.
//
// A deactivated account keeps a perfectly valid cookie until it expires, and
// proxy.ts goes on trusting that cookie because it runs on the Edge and cannot
// ask the database anything. So the dashboard layout, which does check, cannot
// simply redirect to /login: the proxy would see a signed-in user landing on an
// auth page and send them straight back, round and round. Only a route handler
// can clear the cookie, so the layout sends them here instead.

import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export async function GET(request: Request) {
  const login = NextResponse.redirect(new URL("/login", request.url));

  // Deliberately does not read the session first. Doing so would call auth(),
  // and Auth.js re-encodes and re-sets the session cookie on every read, so the
  // response would carry both a freshly issued token and the instruction to
  // clear it, and which one survived would come down to the order the client
  // happened to apply them in. curl keeps the wrong one. One writer only.
  //
  // That leaves a GET which signs out whoever loads it, so it is fenced off with
  // Sec-Fetch-Site: the layout's redirect is a same-origin navigation, an <img>
  // on somebody else's page is not. Browsers that send no such header fall
  // through, which is acceptable because the worst this endpoint can do to a
  // legitimate session is end it.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return login;

  await signOut({ redirect: false });
  return login;
}
