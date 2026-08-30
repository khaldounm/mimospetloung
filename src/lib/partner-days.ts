import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { toDateOnly } from "@/utils/format";
import type { PartnerDayDTO } from "@/types/entities";

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);

// A calendar date as the DB stores one: midnight UTC on a @db.Date column.
// Built from the YYYY-MM-DD the UI works in, never from `new Date()`, so an
// evening in Beirut cannot file against tomorrow.
export function dateOnly(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

// First day of `month` (YYYY-MM) and of the month after it.
function monthBounds(month: string): { from: Date; toExclusive: Date } {
  const [y, m] = month.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y, m - 1, 1)),
    toExclusive: new Date(Date.UTC(y, m, 1)),
  };
}

// What one attended day is worth, and what the guarantee makes of it.
//
// The floor is PER DAY, which is the deal as agreed: a quiet Monday is topped
// up to the minimum even though a busy Tuesday cleared it. Netting the two off
// against each other would be a monthly floor, which pays less and is a
// different agreement.
//
// `earned` counts SERVICE accruals only. A partner who also consigns stock is
// earning that on their capital, not their day, and letting it offset the
// guarantee would use their own investment to pay their wage.
export function topUpFor(
  earned: Prisma.Decimal,
  minimum: Prisma.Decimal | null,
): Prisma.Decimal {
  if (minimum == null) return D(0);
  const short = minimum.minus(earned);
  return short.greaterThan(0) ? short : D(0);
}

export async function getPartnerDays(
  partnerId: number,
  month: string,
): Promise<PartnerDayDTO[]> {
  const { from, toExclusive } = monthBounds(month);
  const where = { partnerId, earnedOn: { gte: from, lt: toExclusive } };

  const [partner, attendance, earnedByDay, settledRows] = await Promise.all([
    prisma.partner.findFirst({
      where: { partnerId, deletedAt: null },
      select: { dailyMinimum: true },
    }),
    prisma.partnerAttendance.findMany({
      where: { partnerId, onDate: { gte: from, lt: toExclusive } },
      orderBy: { onDate: "asc" },
      select: { onDate: true, notes: true },
    }),
    // One grouped scan per month rather than a query per day. Served by
    // idx_partner_accruals_partner_day.
    prisma.partnerAccrual.groupBy({
      by: ["earnedOn"],
      where: { ...where, source: "service", reversedAt: null },
      _sum: { amount: true },
    }),
    prisma.partnerAccrual.findMany({
      where: { ...where, source: "guarantee", reversedAt: null },
      select: { earnedOn: true, amount: true },
    }),
  ]);
  if (!partner) throw new ApiError(404, "Partner not found");

  const earnedMap = new Map(
    earnedByDay.map((g) => [toDateOnly(g.earnedOn)!, g._sum.amount ?? D(0)]),
  );
  const settledMap = new Map(
    settledRows.map((r) => [toDateOnly(r.earnedOn)!, r.amount]),
  );

  // Days the partner was here. A day they earned on without being marked
  // present still shows, because the earning proves they were: it would
  // otherwise be missing from the month it belongs to.
  const days = new Set<string>([
    ...attendance.map((a) => toDateOnly(a.onDate)!),
    ...earnedMap.keys(),
  ]);
  const attendedSet = new Set(attendance.map((a) => toDateOnly(a.onDate)!));

  return [...days].sort().map((day) => {
    const earned = earnedMap.get(day) ?? D(0);
    const settled = settledMap.get(day) ?? null;
    return {
      date: day,
      attended: attendedSet.has(day),
      earned: earned.toFixed(2),
      minimum: partner.dailyMinimum?.toFixed(2) ?? null,
      // What settling would add. Once settled this is the frozen figure, not a
      // fresh calculation, so a later void cannot silently restate a day that
      // has already been agreed.
      topUp: (settled ?? topUpFor(earned, partner.dailyMinimum)).toFixed(2),
      settled: settled != null,
    };
  });
}

// Freeze one day's shortfall as money owed.
//
// Only an ATTENDED day can be settled: the guarantee pays for turning up, and
// the app cannot tell a quiet day from a day off without someone saying so.
export async function settlePartnerDay(
  partnerId: number,
  day: string,
): Promise<Prisma.Decimal> {
  const earnedOn = dateOnly(day);

  return prisma.$transaction(async (tx) => {
    const partner = await tx.partner.findFirst({
      where: { partnerId, deletedAt: null },
      select: { dailyMinimum: true },
    });
    if (!partner) throw new ApiError(404, "Partner not found");
    if (partner.dailyMinimum == null) {
      throw new ApiError(
        400,
        "This partner has no daily minimum, so there is nothing to guarantee. Set one on their profile first.",
      );
    }

    const attended = await tx.partnerAttendance.findUnique({
      where: { partnerId_onDate: { partnerId, onDate: earnedOn } },
      select: { attendanceId: true },
    });
    if (!attended) {
      throw new ApiError(
        400,
        "Mark the partner present on this day before settling it. The minimum is owed for being here, so somebody has to say they were.",
      );
    }

    const existing = await tx.partnerAccrual.findFirst({
      where: { partnerId, earnedOn, source: "guarantee", reversedAt: null },
      select: { accrualId: true },
    });
    if (existing) throw new ApiError(409, "This day is already settled");

    const earnedAgg = await tx.partnerAccrual.aggregate({
      _sum: { amount: true },
      where: { partnerId, earnedOn, source: "service", reversedAt: null },
    });
    const earned = earnedAgg._sum.amount ?? D(0);
    const topUp = topUpFor(earned, partner.dailyMinimum);

    // A day that cleared its minimum is still settled, just with nothing to
    // add. Writing the zero is what makes the day answer "yes, this was
    // checked" rather than "nobody has looked at this yet".
    await tx.partnerAccrual.create({
      data: {
        partnerId,
        source: "guarantee",
        earnedOn,
        revenue: D(0),
        costBasis: D(0),
        amount: topUp,
        costPart: D(0),
      },
    });
    return topUp;
  });
}

// Undo a settlement so the day can be settled again at a corrected figure.
// Soft, like every reversal here: the row keeps what it said.
export async function unsettlePartnerDay(
  partnerId: number,
  day: string,
): Promise<void> {
  const { count } = await prisma.partnerAccrual.updateMany({
    where: {
      partnerId,
      earnedOn: dateOnly(day),
      source: "guarantee",
      reversedAt: null,
    },
    data: { reversedAt: new Date() },
  });
  if (count === 0) throw new ApiError(404, "This day is not settled");
}
