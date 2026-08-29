import { NextResponse } from "next/server";
import { handle, requirePermission } from "@/lib/api";
import { auditPrunePreview, pruneAuditLog, writeAudit } from "@/lib/audit";
import { AUDIT_RETENTION_DAYS } from "@/constants/audit";

// Everything under /api/settings is administrative and rides on users:write,
// enforced by the proxy's route rules and again here so the handler is safe on
// its own. Deliberately not audit:read: viewing the log and emptying it are
// different privileges, and only an admin gets the second.
const PERMISSION = "users:write";

// How many entries the button would remove, so the confirmation can name a real
// number instead of asking for a blind yes.
export async function GET() {
  return handle(async () => {
    await requirePermission(PERMISSION);
    return NextResponse.json(await auditPrunePreview(AUDIT_RETENTION_DAYS));
  });
}

// Irreversible. The typed confirmation lives in the UI; this end refuses to act
// without the same phrase, so the destructive path cannot be reached by a stray
// fetch or a mis-click on a link.
export async function DELETE(request: Request) {
  return handle(async () => {
    const session = await requirePermission(PERMISSION);

    const confirm = new URL(request.url).searchParams.get("confirm");
    if (confirm !== "DELETE LOGS") {
      return NextResponse.json(
        { error: "Confirmation phrase required" },
        { status: 400 },
      );
    }

    const { deleted, cutoff } = await pruneAuditLog(AUDIT_RETENTION_DAYS);

    // Written after the delete, so this entry survives it and the log is never
    // silently empty: whoever emptied it, and when, is the one thing that must
    // outlive the prune.
    await writeAudit(session, {
      action: "delete",
      entity: "audit_log",
      entityId: 0,
      changes: { deleted, cutoff, olderThanDays: AUDIT_RETENTION_DAYS },
    });

    return NextResponse.json({ deleted, cutoff });
  });
}
