import { NextResponse } from "next/server";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import {
  findRedeemableGrant,
  grantOffer,
  listClientGrants,
} from "@/lib/offers";
import { grantOfferSchema } from "@/schemas/offer";

// What one client holds, and which single grant an invoice could spend right
// now. Both in one response: the client page draws the whole list, the invoice
// banner reads `redeemable`, and neither has to work out expiry for itself.
export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("invoices:read");

    const clientId = Number(
      new URL(request.url).searchParams.get("clientId") ?? "",
    );
    if (!Number.isInteger(clientId) || clientId <= 0) {
      throw new ApiError(400, "A clientId is required");
    }

    const [grants, redeemable] = await Promise.all([
      listClientGrants(clientId),
      findRedeemableGrant(clientId),
    ]);
    return NextResponse.json({ grants, redeemable });
  });
}

// Gives one offer to a set of clients: the top-clients table grants to a
// selection, the client page grants to one. Same call either way.
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const input = await parseBody(request, grantOfferSchema);

    const result = await grantOffer(
      input.offerId,
      input.clientIds,
      session.user.userId,
    );

    // Logged against the offer rather than per client: one action by one person
    // covering a batch reads as one line, and the payload names who it hit.
    await writeAudit(session, {
      action: "grant",
      entity: "offer",
      entityId: input.offerId,
      changes: {
        offerName: result.offerName,
        granted: result.granted,
        alreadyHeld: result.alreadyHeld,
        clientIds: input.clientIds,
      },
    });

    return NextResponse.json({ result });
  });
}
