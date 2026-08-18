import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { prisma } from "@/lib/prisma";
import { auditInclude, toAuditDTO } from "@/lib/audit";
import AuditTable from "@/components/audit/AuditTable";

export default async function AuditPage() {
  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      include: auditInclude,
      orderBy: { auditId: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { userId: true, firstName: true, lastName: true },
    }),
  ]);

  const userOptions = users.map((u) => ({
    userId: u.userId,
    label: `${u.firstName} ${u.lastName}`,
  }));

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Audit log
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every create, update, and delete across the system. Showing the 200 most
        recent entries; use the filters to narrow by module, action, user, or
        date.
      </Typography>
      <AuditTable initialLogs={logs.map(toAuditDTO)} users={userOptions} />
    </Box>
  );
}
