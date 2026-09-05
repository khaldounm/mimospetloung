"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { apiRequest } from "@/utils/api-client";

// How long the tab has to have been hidden before coming back to it is worth a
// question. Alt-tabbing between two windows should not fire a request each way;
// walking away from the till and returning should.
const HIDDEN_GRACE_MS = 30_000;

// One navigation asks once. The click starts the check and the pathname change
// that follows it a moment later is the same navigation arriving, so anything
// this close behind is swallowed rather than asked again.
const COALESCE_MS = 1_500;

/**
 * Ends a session that has stopped being valid, from the client, as early in a
 * navigation as possible.
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
 * route handler that can actually clear the cookie.
 *
 * WHY THE CLICK AND NOT JUST THE PATHNAME. `usePathname` only changes once a
 * navigation has committed, so checking there meant the dead page rendered and
 * painted first and the person was yanked out of it a moment later. It read as
 * the app changing its mind. Listening for the click instead starts the check in
 * parallel with the navigation, so the two round trips overlap and the 401
 * usually wins: you go from the page you were on to the sign-in screen, and the
 * page you were never allowed to see does not paint at all. The pathname effect
 * stays as the backstop for navigation that no anchor started.
 */
export function useSessionWatch(): void {
  const pathname = usePathname();
  // The first run is skipped: the page this mounts on was just rendered by the
  // layout, which checked the session on the way through. Asking again here
  // would put a second request on every full page load for no new information.
  const mounted = useRef(false);
  const lastCheck = useRef(0);

  // Held in a ref so the listeners below can share the coalescing window
  // without being torn down and re-added on every navigation.
  const checkOnce = useRef(() => {
    const now = Date.now();
    if (now - lastCheck.current < COALESCE_MS) return;
    lastCheck.current = now;
    void check();
  });

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    checkOnce.current();
  }, [pathname]);

  useEffect(() => {
    // Capture phase, so the check is already in flight before the router has
    // begun handling the click.
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      // A modified click opens a new tab and leaves this one where it is.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;

      // In-app navigation only. An absolute URL, a new tab or a download is
      // going somewhere this session does not follow.
      const href = anchor.getAttribute("href");
      if (!href?.startsWith("/") || href.startsWith("/api/")) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("target") === "_blank") return;

      checkOnce.current();
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    let hiddenAt: number | null = null;

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= HIDDEN_GRACE_MS) checkOnce.current();
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
