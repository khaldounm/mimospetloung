import { NextResponse } from "next/server";
import { handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { applyPermissionToggle, getPermissionMatrix } from "@/lib/rbac";
import { permissionToggleSchema } from "@/schemas/rbac";

// Everything under /api/settings is already gated to users:write by the proxy
// route rules; the explicit guard here is what stops a direct call.

export async function GET() {
  return handle(async () => {
    await requirePermission("users:write");
    return NextResponse.json(await getPermissionMatrix());
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const session = await requirePermission("users:write");
    const data = await parseBody(request, permissionToggleSchema);

    const changes = await applyPermissionToggle(data);

    // Who may do what is exactly the kind of change the audit log exists for.
    // A click that changed nothing writes nothing.
    if (changes.length > 0) {
      await writeAudit(session, {
        action: "update",
        entity: "role",
        entityId: data.roleId,
        changes: {
          clicked: `${data.permission}=${data.granted ? "on" : "off"}`,
          applied: changes.map(
            (c) => `${c.permission}=${c.granted ? "on" : "off"}`,
          ),
        },
      });
    }

    // The full matrix comes back rather than an ack, so the screen redraws from
    // the database instead of from what the click assumed.
    return NextResponse.json(await getPermissionMatrix());
  });
}
