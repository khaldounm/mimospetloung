import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseId, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

async function getIds(
  params: Promise<{ partnerId: string; payoutId: string }>,
) {
  const { partnerId, payoutId } = await params;
  return {
    partnerId: parseId(partnerId, "partner id"),
    payoutId: parseId(payoutId, "payout id"),
  };
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string; payoutId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("partners:write");
    const { partnerId, payoutId } = await getIds(params);

    const existing = await prisma.partnerPayout.findFirst({
      where: { payoutId, partnerId, deletedAt: null },
      select: { payoutId: true },
    });
    if (!existing) throw new ApiError(404, "Payout not found");

    // Soft-delete so the balance recomputes without losing the history.
    await prisma.partnerPayout.update({
      where: { payoutId },
      data: { deletedAt: new Date() },
    });
    await writeAudit(session, {
      action: "delete",
      entity: "partner_payout",
      entityId: payoutId,
      changes: { softDelete: true },
    });
    return NextResponse.json({ ok: true });
  });
}
