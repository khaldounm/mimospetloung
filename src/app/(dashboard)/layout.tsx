import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import DashboardShell from "@/components/ui/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
