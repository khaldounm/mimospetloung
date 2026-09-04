"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { apiRequest } from "@/utils/api-client";

// How long the tab has to have been hidden before coming back to it is worth a
// question. Alt-tabbing between two windows should not fire a request each way;
// walking away from the till and returning should.
const HIDDEN_GRACE_MS = 30_000;

/**
 * Ends a session that has stopped being valid, from the client, on navigation
 * and on returning to the tab.
 *
 * This exists because every server-side attempt at it failed, and the failures
 * are worth recording so nobody tries them again:
 *
 * - A guard in `(dashboard)/layout.tsx` runs on a full page load and then never
 *   again. Next.js keeps a layout mounted across client-side navigation, and the
 *   whole nav is built from `next/link`, so clicking around never re-ran it.
 * - A guard in a `template.tsx` does re-render per navigation, but its
 *   `redirect()` goes to `/api/account/signout`, a route handler. The client
 *   router cannot follow a soft-navigation redirect into one, so nothing
 *   happened. Verified against the clinic: menu and tab clicks did not eject.
 * - The top-level module pages do not enforce at all. They read `session?.user`
 *   and render with nothing rather than redirecting.
 *
 * What has always worked, proven at the clinic, is an API call coming back 401:
 * `apiRequest` calls `redirectToSignIn()`, which sets `window.location.href`.
 * That is a real browser navigation rather than a router one, so it reaches the
 * route handler that can actually clear the cookie. Filtering or searching
 * ejected instantly for exactly this reason.
 *
 * So this hook does not invent a mechanism. It asks the cheapest possible
 * question at the two moments the app would otherwise never ask, and lets the
 * path that already works do the ejecting.
 */
export function useSessionWatch(): void {
  const pathname = usePathname();
  // The first run is skipped: the page this mounts on was just rendered by the
  // layout, which checked the session on the way through. Asking again here
  // would put a second request on every full page load for no new information.
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    void check();
  }, [pathname]);

  useEffect(() => {
    let hiddenAt: number | null = null;

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= HIDDEN_GRACE_MS) void check();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
}

// A 401 is handled inside apiRequest, which redirects and then throws so the
// caller stops. There is nothing to do with that throw here, and nothing to do
// with a network failure either: a till that is offline should stay on screen
// rather than be thrown out for it.
async function check(): Promise<void> {
  try {
    await apiRequest("/api/account/session");
  } catch {
    // Intentionally ignored. See above.
  }
}
