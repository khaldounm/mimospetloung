import { NextResponse } from "next/server";
import { ApiError, handle, parseId, requirePermission } from "@/lib/api";
import { getMedicalRecord } from "@/lib/medical-record";
import { sendDocumentViaWhatsApp } from "@/lib/notifications";
import { signPdfToken } from "@/lib/pdf-token";
import { hasPermission } from "@/lib/permissions";
import {
  medicalRecordFileName,
  medicalRecordWhatsAppMessage,
} from "@/utils/whatsapp";
import { normalizePhone } from "@/utils/phone";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Sends the patient's full medical record PDF to the owner's WhatsApp number
// via WaSenderApi. The provider fetches the file from a short-lived,
// token-signed public URL.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("notifications:write");
    // Sending is a read of the clinical history, so it takes the clinical
    // permission too: notifications:write alone must not become a side door
    // around the record the patient page hides.
    if (!hasPermission(session.user, "clinical:read")) {
      throw new ApiError(403, "Forbidden");
    }

    const { patientId } = await params;
    const id = parseId(patientId, "patient id");

    const record = await getMedicalRecord(id);
    if (!record) throw new ApiError(404, "Patient not found");

    const recipient = normalizePhone(record.clientPhone);
    if (!recipient) {
      throw new ApiError(400, "This client has no valid phone number on file.");
    }

    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("host");
    if (!host) throw new ApiError(500, "Unable to resolve public URL");
    const token = signPdfToken("medical-record", id);
    const documentUrl = `${proto}://${host}/api/public/patients/${id}/medical-record/pdf?token=${token}`;

    // The provider's own message ("invalid API key", "not connected") is what
    // tells staff whether to retry or to call someone, so it is surfaced rather
    // than collapsed into a generic 500 by the outer handler.
    let messageId: string;
    try {
      messageId = await sendDocumentViaWhatsApp(
        recipient,
        documentUrl,
        medicalRecordFileName(record),
        medicalRecordWhatsAppMessage(record),
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
      entity: "patient",
      entityId: id,
      changes: {
        document: "medical-record",
        channel: "whatsapp",
        recipient,
        messageId,
      },
    });

    return NextResponse.json({ ok: true, messageId });
  });
}
