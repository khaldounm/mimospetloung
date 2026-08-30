import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  handle,
  parseBody,
  parseId,
  requirePermission,
} from "@/lib/api";
import {
  dateOnly,
  getPartnerDays,
  settlePartnerDay,
  unsettlePartnerDay,
} from "@/lib/partner-days";
import { writeAudit } from "@/lib/audit";
import { partnerDayActionSchema, partnerMonthSchema } from "@/schemas/partner";

async function getPartnerId(params: Promise<{ partnerId: string }>) {
  return parseId((await params).partnerId, "partner id");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  return handle(async () => {
    await requirePermission("partners:read");
    const partnerId = await getPartnerId(params);
    const month = partnerMonthSchema.parse(
      new URL(request.url).searchParams.get("month"),
    );

    return NextResponse.json({ days: await getPartnerDays(partnerId, month) });
  });
}

// One endpoint for the four things that can happen to a day, because they are
// the same decision seen from different sides and splitting them into four
// routes would spread one rule across four files.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("partners:write");
    const partnerId = await getPartnerId(params);
    const { action, date, notes } = await parseBody(
      request,
      partnerDayActionSchema,
    );
    const onDate = dateOnly(date);

    if (action === "attend") {
      await prisma.partnerAttendance.upsert({
        where: { partnerId_onDate: { partnerId, onDate } },
        create: {
          partnerId,
          onDate,
          notes,
          createdBy: session.user.userId ?? null,
        },
        update: { notes },
      });
    } else if (action === "absent") {
      // A settled day has already been paid on the strength of the partner
      // being here. Unmarking it would leave the money owed with nothing
      // behind it, so the settlement has to be undone first and seen to be.
      const settled = await prisma.partnerAccrual.findFirst({
        where: {
          partnerId,
          earnedOn: onDate,
          source: "guarantee",
          reversedAt: null,
        },
        select: { accrualId: true },
      });
      if (settled) {
        throw new ApiError(
          409,
          "This day is settled. Undo the settlement before marking the partner absent.",
        );
      }
      await prisma.partnerAttendance.deleteMany({
        where: { partnerId, onDate },
      });
    } else if (action === "settle") {
      await settlePartnerDay(partnerId, date);
    } else {
      await unsettlePartnerDay(partnerId, date);
    }

    await writeAudit(session, {
      action: action === "attend" ? "create" : "update",
      entity: "partner_day",
      entityId: partnerId,
      changes: { action, date },
    });

    return NextResponse.json({
      days: await getPartnerDays(partnerId, date.slice(0, 7)),
    });
  });
}
