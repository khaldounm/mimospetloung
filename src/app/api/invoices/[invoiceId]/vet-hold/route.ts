import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { invoiceInclude, toInvoiceDTO } from "@/lib/invoices";
import { writeAudit } from "@/lib/audit";
import { vetHoldSchema } from "@/schemas/invoice";

// Marks a draft invoice as still being worked on by a vet, or clears that mark.
//
// Kept explicit rather than derived from the linked booking: not every invoice
// comes from a booking, and booking statuses are only as current as whoever
// remembered to update them. A hold that reception can trust has to be set by
// the person actually holding it.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const { invoiceId: rawId } = await params;
    const invoiceId = Number(rawId);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      throw new ApiError(400, "Invalid id");
    }

    const data = await parseBody(request, vetHoldSchema);

    const existing = await prisma.invoice.findUnique({
      where: { invoiceId },
      select: { status: true },
    });
    if (!existing) throw new ApiError(404, "Invoice not found");
    if (existing.status !== "Draft") {
      throw new ApiError(409, "Only a draft invoice can be held");
    }

    const invoice = await prisma.invoice.update({
      where: { invoiceId },
      data: data.hold
        ? {
            vetHoldAt: new Date(),
            // Defaults to whoever set the hold, which is the vet themselves in
            // the ordinary case.
            attendingVetId: data.attendingVetId ?? session.user.userId,
          }
        : { vetHoldAt: null },
      include: invoiceInclude,
    });

    await writeAudit(session, {
      action: "update",
      entity: "invoice",
      entityId: invoiceId,
      changes: { vetHold: data.hold },
    });

    return NextResponse.json({ invoice: toInvoiceDTO(invoice) });
  });
}
