import { NextResponse } from "next/server";

// WhatsApp Cloud API webhook.
//
// GET  = Meta's subscription verification handshake. Returns hub.challenge when
//        the verify token matches WHATSAPP_VERIFY_TOKEN.
// POST = inbound status/message callbacks. We acknowledge with 200 so Meta does
//        not retry. NOTE: the notifications table has no column for the provider
//        message id (wamid), so we cannot map a delivery status back to a
//        specific row to auto-advance it to Delivered/Failed. We log the payload
//        for now; persisting the wamid would require a schema change (Phase 9+).
//
// This route is intentionally not session-gated (Meta calls it unauthenticated);
// it is excluded from the auth middleware and secured by the verify token.

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    // Meta expects the raw challenge echoed back as plain text.
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    // Visible in server logs until delivery-status persistence is added.
    console.log("[whatsapp webhook]", JSON.stringify(payload));
  } catch {
    // Always acknowledge so Meta does not retry indefinitely.
  }
  return NextResponse.json({ received: true });
}
