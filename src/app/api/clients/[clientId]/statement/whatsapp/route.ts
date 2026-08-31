import { NextResponse } from "next/server";
import {
  ApiError,
  handle,
  parseBody,
  parseId,
  requirePermission,
} from "@/lib/api";
import { getClientStatement } from "@/lib/client-statement";
import { sendDocumentViaWhatsApp } from "@/lib/notifications";
import { signPdfToken } from "@/lib/pdf-token";
import { hasPermission } from "@/lib/permissions";
import { clientStatementSendSchema } from "@/schemas/client";
import { rangeFromParams } from "@/utils/date-range";
import {
  clientStatementFileName,
  clientStatementWhatsAppMessage,
} from "@/utils/whatsapp";
import { normalizePhone } from "@/utils/phone";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Sends a client their statement of account as a PDF over WhatsApp via
// WaSenderApi. The provider fetches the file from a short-lived, token-signed
// public URL.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("notifications:write");
    // Sending is a read of the client's whole account history, so it takes the
    // permission that gates the client record too: notifications:write alone
    // must not become a side door around it.
    if (!hasPermission(session.user, "patients:read")) {
      throw new ApiError(403, "Forbidden");
    }

    const { clientId } = await params;
    const id = parseId(clientId, "client id");
    const body = await parseBody(request, clientStatementSendSchema);
    const range = rangeFromParams(body.from, body.to);
    const detailed = body.detailed === true;

    const statement = await getClientStatement(id, range);
    if (!statement) throw new ApiError(404, "Client not found");

    const recipient = normalizePhone(statement.clientPhone);
    if (!recipient) {
      throw new ApiError(400, "This client has no valid phone number on file.");
    }

    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("host");
    if (!host) throw new ApiError(500, "Unable to resolve public URL");
    const token = signPdfToken("client-statement", id);
    // The period rides in the query string rather than in the signature. It
    // only ever narrows which of this client's own rows are listed, and the
    // client is the one receiving the file, so there is nothing behind it that
    // the token is not already protecting.
    const query = new URLSearchParams({
      token,
      from: statement.range.from,
      to: statement.range.to,
    });
    if (detailed) query.set("detailed", "1");
    const documentUrl = `${proto}://${host}/api/public/clients/${id}/statement/pdf?${query}`;

    // The provider's own message ("invalid API key", "not connected") is what
    // tells staff whether to retry or to call someone, so it is surfaced rather
    // than collapsed into a generic 500 by the outer handler.
    let messageId: string;
    try {
      messageId = await sendDocumentViaWhatsApp(
        recipient,
        documentUrl,
        clientStatementFileName(statement),
        clientStatementWhatsAppMessage(statement),
      );
    } catch (err) {
      throw new ApiError(
        502,
        err instanceof Error
          ? `WhatsApp send failed: ${err.message}`
          : "WhatsApp send failed",
      );
    }

    await writeAudit(session, {
      action: "send",
      entity: "client",
      entityId: id,
      changes: {
        document: "statement",
        channel: "whatsapp",
        recipient,
        messageId,
        from: statement.range.from,
        to: statement.range.to,
        detailed,
        balance: statement.accountBalance,
      },
    });

    return NextResponse.json({ ok: true, messageId });
  });
}
