import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  handle,
  parseBody,
  parseId,
  requirePermission,
} from "@/lib/api";
import { partnerPayoutInclude, toPartnerPayoutDTO } from "@/lib/partners";
import { writeAudit } from "@/lib/audit";
import { partnerPayoutCreateSchema } from "@/schemas/partner";

async function getPartnerId(params: Promise<{ partnerId: string }>) {
  return parseId((await params).partnerId, "partner id");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("partners:write");
    const partnerId = await getPartnerId(params);
    const data = await parseBody(request, partnerPayoutCreateSchema);

    const partner = await prisma.partner.findFirst({
      where: { partnerId, deletedAt: null },
      select: { partnerId: true },
    });
    if (!partner) throw new ApiError(404, "Partner not found");

    // Block overpayment, mirroring invoice payments: a payout cannot exceed what
    // is currently owed (accrued payable minus payouts already recorded).
    const [earnedAgg, paidAgg] = await Promise.all([
      prisma.inventoryTransaction.aggregate({
        _sum: { partnerPayable: true },
        where: { partnerId },
      }),
      prisma.partnerPayout.aggregate({
        _sum: { amount: true },
        where: { partnerId, deletedAt: null },
      }),
    ]);
    const balance = (
      earnedAgg._sum.partnerPayable ?? new Prisma.Decimal(0)
    ).minus(paidAgg._sum.amount ?? 0);
    if (new Prisma.Decimal(data.amount).gt(balance)) {
      throw new ApiError(
        400,
        `Payout exceeds the outstanding balance of ${balance.toFixed(2)}.`,
      );
    }

    const payout = await prisma.partnerPayout.create({
      data: {
        partnerId,
        amount: data.amount,
        paidOn: data.paidOn,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        createdBy: session.user.userId ?? null,
      },
      include: partnerPayoutInclude,
    });
    await writeAudit(session, {
      action: "payment",
      entity: "partner_payout",
      entityId: payout.payoutId,
      changes: data,
    });
    return NextResponse.json(
      { payout: toPartnerPayoutDTO(payout) },
      { status: 201 },
    );
  });
}
