import { redirect } from "next/navigation";
import { liveSession } from "@/lib/session-user";
import DashboardShell from "@/components/ui/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await liveSession();
  // Null means the account behind the cookie is gone or deactivated, since a
  // request with no cookie at all never reaches this layout: proxy.ts turns
  // those away first. Redirecting to /login would bounce off that same proxy,
  // which still reads the cookie as valid, so go somewhere that can clear it.
  if (!session?.user) redirect("/api/account/signout");

  const user = session.user;

  return (
    <DashboardShell
      permissions={user.permissions ?? []}
      firstName={user.firstName ?? null}
      lastName={user.lastName ?? null}
      roleName={user.roleName ?? null}
    >
      {children}
    </DashboardShell>
  );
}
