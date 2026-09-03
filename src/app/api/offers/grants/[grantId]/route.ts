import { NextResponse } from "next/server";
import { handle, parseId, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { revokeGrant } from "@/lib/offers";

// Takes an unspent offer back off a client. A spent one is refused: undoing
// that means taking it off the invoice it paid for, which is a different door.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ grantId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const { grantId } = await params;
    const id = parseId(grantId, "grant id");

    await revokeGrant(id);

    await writeAudit(session, {
      action: "delete",
      entity: "offer_grant",
      entityId: id,
      changes: { revoked: true },
    });

    return NextResponse.json({ ok: true });
  });
}
