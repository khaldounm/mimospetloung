import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { listClients } from "@/lib/clients";
import { clientCreateSchema } from "@/schemas/client";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("patients:read");

    const sp = new URL(request.url).searchParams;
    const pageRaw = sp.get("page")?.trim();

    // Paged and filtered in SQL; the response also carries the letter buckets
    // so the jump bar reflects the data rather than a hardcoded alphabet.
    const page = await listClients({
      q: sp.get("q")?.trim() || undefined,
      letter: sp.get("letter")?.trim() || undefined,
      page: pageRaw ? Number(pageRaw) : 1,
      needsReview: sp.get("review") === "1",
      balance:
        sp.get("balance") === "debt"
          ? "debt"
          : sp.get("balance") === "credit"
            ? "credit"
            : undefined,
    });

    return NextResponse.json(page);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("patients:write");
    const data = await parseBody(request, clientCreateSchema);

    const client = await prisma.client.create({ data });
    await writeAudit(session, {
      action: "create",
      entity: "client",
      entityId: client.clientId,
      changes: data,
    });
    return NextResponse.json({ client }, { status: 201 });
  });
}
