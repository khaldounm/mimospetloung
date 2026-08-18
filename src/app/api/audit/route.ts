import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { handle, requirePermission } from "@/lib/api";
import { auditInclude, toAuditDTO } from "@/lib/audit";

// Read-only audit trail. Filters: entity, action, userId, and a created-at
// date range (from / to, inclusive of the whole "to" day). Newest first,
// capped at 200 rows to keep the response bounded.
export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("audit:read");

    const sp = new URL(request.url).searchParams;
    const entity = sp.get("entity")?.trim();
    const action = sp.get("action")?.trim();
    const userId = Number(sp.get("userId"));
    const entityId = Number(sp.get("entityId"));
    const from = sp.get("from")?.trim();
    const to = sp.get("to")?.trim();

    const createdAt: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        // Include the entire "to" day when only a date is supplied.
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(action ? { action } : {}),
        ...(Number.isInteger(userId) && userId > 0 ? { userId } : {}),
        ...(Number.isInteger(entityId) && entityId > 0 ? { entityId } : {}),
        ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
      },
      include: auditInclude,
      orderBy: { auditId: "desc" },
      take: 200,
    });

    return NextResponse.json({ logs: logs.map(toAuditDTO) });
  });
}
