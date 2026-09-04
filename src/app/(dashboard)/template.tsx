import { redirect } from "next/navigation";
import { liveSession } from "@/lib/session-user";

// The session guard that actually runs on every navigation.
//
// The one in layout.tsx does not, and that is the whole reason this file
// exists. Next.js renders a layout on a full page load and then KEEPS it
// mounted for every client-side navigation underneath it, so once the dashboard
// shell is up its liveSession() call never runs again. The nav is built from
// next/link, so every click inside the app is a client-side navigation. And the
// top-level module pages do not enforce anything of their own: they read
// `session?.user` and render with nothing rather than redirecting.
//
// Put together, a demoted or signed-out user could click around the entire app
// indefinitely and was only ejected when they happened to press refresh.
// Reported from the clinic on 2026-09-05: "not working at all UNLESS I
// REFRESH". Making the live read fresher did not touch this. The check was not
// stale, it was not running.
//
// A template is a layout that re-renders on every navigation, which is exactly
// the guarantee this check needs. It renders nothing of its own and adds no
// markup; it exists to run.
//
// Cost is one liveSession() per navigation. On a full page load the layout asks
// for the same thing and React's cache() in session-user.ts collapses the two
// into a single query.
export default async function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await liveSession();
  // Same destination as the layout, and for the same reason: /login would
  // bounce straight back off proxy.ts, which still reads the cookie as valid.
  // Only a route handler can clear a cookie.
  if (!session?.user) redirect("/api/account/signout");

  return <>{children}</>;
}
