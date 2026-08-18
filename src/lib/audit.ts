import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";
import type { AuditAction, AuditEntity } from "@/constants/audit";
import type { AuditLogDTO } from "@/types/entities";

export const auditInclude = {
  user: { select: { firstName: true, lastName: true } },
} as const;

type AuditRow = Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>;

export function toAuditDTO(a: AuditRow): AuditLogDTO {
  return {
    auditId: a.auditId.toString(),
    userId: a.userId,
    userName: a.user ? `${a.user.firstName} ${a.user.lastName}` : null,
    action: a.action,
    entity: a.entity,
    entityId: a.entityId,
    changes: a.changes,
    createdAt: a.createdAt.toISOString(),
  };
}

interface AuditEntry {
  action: AuditAction;
  entity: AuditEntity;
  entityId: number;
  // Any JSON-serializable snapshot of what changed. Dates / Decimals are
  // normalized to strings before storage; undefined keys are dropped.
  changes?: unknown;
}

// Normalizes arbitrary input into a Prisma JSON value: Dates -> ISO strings,
// Prisma Decimals -> strings, undefined keys removed.
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// Records an audit_log row for a mutation. Best-effort by design: a logging
// failure must never break the user's operation, so errors are swallowed and
// logged. Pass the Session returned by requirePermission to capture the actor.
export async function writeAudit(
  session: Session | null | undefined,
  entry: AuditEntry,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: session?.user?.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        changes:
          entry.changes === undefined ? undefined : toJson(entry.changes),
      },
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}
