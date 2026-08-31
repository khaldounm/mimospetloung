import { renderToBuffer } from "@react-pdf/renderer";
import { getClientStatement } from "@/lib/client-statement";
import { verifyPdfToken } from "@/lib/pdf-token";
import { CLINIC } from "@/constants/clinic";
import { rangeFromParams } from "@/utils/date-range";
import ClientStatementPdfDocument from "@/components/clients/ClientStatementPdfDocument";

// PDF rendering needs the Node runtime (fontkit / Buffer), not the edge.
export const runtime = "nodejs";

// Public, token-authorized client statement PDF. WaSenderApi fetches this URL
// to attach the file to a WhatsApp message, so it must work without a user
// session. The signed token (see lib/pdf-token) binds the client id and a short
// expiry, which is what keeps an account history off an open URL.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Invalid id", { status: 400 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!verifyPdfToken("client-statement", id, token)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Malformed dates fall back to the whole account rather than erroring: the
  // recipient is holding a link, not a form, and an unreadable period is no
  // reason to hand them a broken download.
  const range = rangeFromParams(
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined,
  );
  const detailed = url.searchParams.get("detailed") === "1";

  const statement = await getClientStatement(id, range);
  if (!statement) return new Response("Not found", { status: 404 });

  const logoSrc = `${url.origin}${CLINIC.logo.src}`;

  const buffer = await renderToBuffer(
    <ClientStatementPdfDocument
      statement={statement}
      detailed={detailed}
      logoSrc={logoSrc}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="statement-${id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
