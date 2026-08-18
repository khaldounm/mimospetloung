import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { defaultRange } from "@/utils/date-range";
import {
  getActivePartners,
  getPartnersWithStats,
  toPartnerDTO,
} from "@/lib/partners";
import { writeAudit } from "@/lib/audit";
import {
  partnerCreateSchema,
  partnerRangeQuerySchema,
} from "@/schemas/partner";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("partners:read");

    const sp = new URL(request.url).searchParams;

    // ?active=1 returns the lightweight active list for the inventory picker;
    // otherwise the full list with the money breakdown.
    if (sp.get("active") === "1") {
      return NextResponse.json({ partners: await getActivePartners() });
    }

    // Sales figures are scoped to the requested range; the balance figures are
    // the position as at its last day.
    const parsed = partnerRangeQuerySchema.safeParse({
      from: sp.get("from"),
      to: sp.get("to"),
    });
    if (sp.has("from") && !parsed.success) {
      throw new ApiError(400, parsed.error.issues[0].message);
    }
    const range = parsed.success ? parsed.data : defaultRange();

    return NextResponse.json({ partners: await getPartnersWithStats(range) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("partners:write");
    const data = await parseBody(request, partnerCreateSchema);

    const partner = await prisma.partner.create({
      data: {
        name: data.name,
        phone: data.phone,
        defaultSharePct: data.defaultSharePct,
        notes: data.notes,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await writeAudit(session, {
      action: "create",
      entity: "partner",
      entityId: partner.partnerId,
      changes: data,
    });
    return NextResponse.json(
      { partner: toPartnerDTO(partner) },
      { status: 201 },
    );
  });
}
