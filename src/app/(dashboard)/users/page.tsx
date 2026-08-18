import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { toUserDTO, userInclude } from "@/lib/users";
import UsersTable from "@/components/users/UsersTable";
import type { RoleOption } from "@/types/entities";

export default async function UsersPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "users:write");
  const currentUserId = session?.user?.userId ?? null;

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: userInclude,
      orderBy: [
        { isActive: "desc" },
        { firstName: "asc" },
        { lastName: "asc" },
      ],
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  const roleOptions: RoleOption[] = roles.map((r) => ({
    roleId: r.roleId,
    name: r.name,
  }));

  return (
    <UsersTable
      initialUsers={users.map(toUserDTO)}
      roleOptions={roleOptions}
      currentUserId={currentUserId}
      canWrite={canWrite}
    />
  );
}
