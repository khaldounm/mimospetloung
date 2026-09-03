import { NextResponse } from "next/server";
import {
  ApiError,
  handle,
  parseBody,
  parseId,
  requirePermission,
} from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { updateOffer } from "@/lib/offers";
import { updateOfferSchema } from "@/schemas/offer";
import { OFFER_MANAGE_PERMISSION } from "@/constants/offers";

// Edits an offer or retires it. Terms stay editable on purpose: a campaign
// extended by a week is the same campaign, and a grant reads its offer live, so
// extending the date extends everyone holding one.
//
// There is no DELETE. An offer that has been given out is part of what happened
// at the counter, so it is archived instead and past grants keep naming it.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    if (!hasPermission(session.user, OFFER_MANAGE_PERMISSION)) {
      throw new ApiError(403, "Only an admin can change an offer");
    }

    const { offerId } = await params;
    const id = parseId(offerId, "offer id");
    const input = await parseBody(request, updateOfferSchema);
    const offer = await updateOffer(id, input);

    await writeAudit(session, {
      action: "update",
      entity: "offer",
      entityId: id,
      changes: {
        name: offer.name,
        discountMode: offer.discountMode,
        discountPct: offer.discountPct,
        discountAmount: offer.discountAmount,
        expiresOn: offer.expiresOn,
        archived: offer.archived,
      },
    });

    return NextResponse.json({ offer });
  });
}
