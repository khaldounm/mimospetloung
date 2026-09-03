import { NextResponse } from "next/server";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { createOffer, listOffers } from "@/lib/offers";
import { createOfferSchema } from "@/schemas/offer";
import { OFFER_MANAGE_PERMISSION } from "@/constants/offers";

// The offer catalogue. Anyone who can read invoices can see what deals exist,
// because they have to pick one to grant; creating a deal is tighter.
export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("invoices:read");
    const includeArchived =
      new URL(request.url).searchParams.get("includeArchived") === "1";
    return NextResponse.json({ offers: await listOffers(includeArchived) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    // Deliberately narrower than granting. If a deal can be invented while
    // looking at one client, the clinic ends up with fifteen spellings of
    // "10% off" and no campaign it can report on.
    if (!hasPermission(session.user, OFFER_MANAGE_PERMISSION)) {
      throw new ApiError(403, "Only an admin can create an offer");
    }

    const input = await parseBody(request, createOfferSchema);
    const offer = await createOffer(input, session.user.userId);

    await writeAudit(session, {
      action: "create",
      entity: "offer",
      entityId: offer.offerId,
      changes: {
        name: offer.name,
        discountMode: offer.discountMode,
        discountPct: offer.discountPct,
        discountAmount: offer.discountAmount,
        expiresOn: offer.expiresOn,
      },
    });

    return NextResponse.json({ offer }, { status: 201 });
  });
}
