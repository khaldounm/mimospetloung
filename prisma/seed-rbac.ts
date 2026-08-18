import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedRbac } from "./rbac";

// Reconciles ONLY the RBAC catalogue (permissions + role grants) with rbac.ts.
// Idempotent and additive: it never touches users, services, or clinic data, so
// it is safe to run against the shared/prod database when new permissions are
// added. After running, affected users must log out and back in for the new
// permissions to enter their JWT.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await seedRbac(prisma);

  const admin = await prisma.role.findUnique({
    where: { name: "Admin" },
    include: { rolePermissions: { include: { permission: true } } },
  });
  const perms = admin?.rolePermissions.map((rp) => rp.permission.name) ?? [];
  console.log(`RBAC seeded. Admin now holds ${perms.length} permissions.`);
  console.log(`  orders:read granted:  ${perms.includes("orders:read")}`);
  console.log(`  orders:write granted: ${perms.includes("orders:write")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
