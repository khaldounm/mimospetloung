// Sessions can end while a screen is still sitting open: an admin signs someone
// out, deactivates them, or grants a permission that forces a fresh sign-in. The
// next call comes back 401 and, without this, the person is left staring at an
// error banner on a page they can no longer use.
//
// The redirect goes to /api/account/signout rather than straight to /login, and
// that distinction matters. The cookie is still in the browser and proxy.ts
// still reads it as a valid session, so /login would bounce them right back to
// the dashboard, which would 401 again. That route clears the cookie first and
// then lands on /login.
//
// Guarded by a flag because a single screen can have several requests in flight,
// and all of them will fail together. Exported so the one caller that cannot use
// apiRequest (a CSV download, which wants a blob rather than JSON) shares it
// instead of growing a second copy.
let redirectingToSignIn = false;

export function redirectToSignIn(): void {
  if (typeof window === "undefined" || redirectingToSignIn) return;
  redirectingToSignIn = true;
  window.location.href = "/api/account/signout";
}

// Thin client-side fetch wrapper for our JSON API routes. Throws an Error with
// the server-provided message on a non-2xx response.
export async function apiRequest<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // 401 means the session itself is gone. 403 is deliberately not included:
  // that is signed in but not allowed, which is a message to read rather than a
  // reason to throw someone out of the app.
  if (res.status === 401) {
    redirectToSignIn();
    throw new Error("Your session has ended. Taking you back to sign in.");
  }

  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}
