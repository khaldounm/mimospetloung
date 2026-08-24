import { renderToBuffer } from "@react-pdf/renderer";
import { getMedicalRecord } from "@/lib/medical-record";
import { verifyPdfToken } from "@/lib/pdf-token";
import { CLINIC } from "@/constants/clinic";
import MedicalRecordPdfDocument from "@/components/patients/MedicalRecordPdfDocument";

// PDF rendering needs the Node runtime (fontkit / Buffer), not the edge.
export const runtime = "nodejs";

// Public, token-authorized medical record PDF. WaSenderApi fetches this URL to
// attach the file to a WhatsApp message, so it must work without a user
// session. The signed token (see lib/pdf-token) binds the patient id and a
// short expiry, which is what keeps clinical history off an open URL.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  const id = Number(patientId);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Invalid id", { status: 400 });
  }

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!verifyPdfToken("medical-record", id, token)) {
    return new Response("Forbidden", { status: 403 });
  }

  const record = await getMedicalRecord(id);
  if (!record) return new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const logoSrc = `${origin}${CLINIC.logo.src}`;

  const buffer = await renderToBuffer(
    <MedicalRecordPdfDocument record={record} logoSrc={logoSrc} />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="medical-record-${id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
