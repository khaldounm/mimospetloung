import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import {
  firstAllowedHref,
  hasPermission,
  requiredPermissionForPath,
} from "@/lib/permissions";

// Edge-safe NextAuth instance (config has no DB/bcrypt providers).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const user = req.auth?.user ?? null;
  const isLoggedIn = Boolean(req.auth);

  // Auth.js endpoints must always pass through.
  if (path.startsWith("/api/auth")) return NextResponse.next();

  // Unauthenticated machine endpoints that authorize themselves:
  //   /api/webhooks/* — verified by provider verify token / signature
  //   /api/cron/*     — verified by the CRON_SECRET bearer token
  //   /api/public/*   — verified by a per-request signed token (e.g. invoice PDF
  //                     links fetched by WaSenderApi)
  if (
    path.startsWith("/api/webhooks") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/public")
  ) {
    return NextResponse.next();
  }

  const isAuthPage = path === "/login" || path === "/reset-password";

  if (!isLoggedIn) {
    if (isAuthPage) return NextResponse.next();
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", nextUrl);
    // Only carry a callbackUrl when it says something the login page does not
    // already assume: it defaults to "/", so tagging the root path on just
    // produces a noisy /login?callbackUrl=%2F. Deep links still round-trip.
    if (path !== "/") loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in: keep users out of the auth pages.
  if (isAuthPage) {
    return NextResponse.redirect(
      new URL(firstAllowedHref(user) ?? "/login", nextUrl),
    );
  }

  // Root → first module the user can see.
  if (path === "/") {
    return NextResponse.redirect(
      new URL(firstAllowedHref(user) ?? "/login", nextUrl),
    );
  }

  // Server-side RBAC: reject access to gated paths without the permission.
  const required = requiredPermissionForPath(path);
  if (required && !hasPermission(user, required)) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(
      new URL(firstAllowedHref(user) ?? "/login", nextUrl),
    );
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
