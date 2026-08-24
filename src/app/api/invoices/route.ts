import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { invoiceInclude, listInvoices, toInvoiceDTO } from "@/lib/invoices";
import { writeAudit } from "@/lib/audit";
import { invoiceCreateSchema } from "@/schemas/invoice";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("invoices:read");

    const sp = new URL(request.url).searchParams;
    const clientIdRaw = sp.get("clientId")?.trim();
    const pageRaw = sp.get("page")?.trim();

    // Paged and filtered in SQL. Returning every invoice meant the browser
    // received thousands of rows, plus a payment row for each, to show 25.
    const page = await listInvoices({
      q: sp.get("q")?.trim() || undefined,
      status: sp.get("status")?.trim() || undefined,
      clientId: clientIdRaw ? Number(clientIdRaw) : undefined,
      page: pageRaw ? Number(pageRaw) : 1,
    });

    return NextResponse.json(page);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const data = await parseBody(request, invoiceCreateSchema);

    // No client means a walk-in, which is a valid invoice with nobody attached.
    // When one is given it still has to exist and not be deleted.
    if (data.clientId !== undefined) {
      const client = await prisma.client.findFirst({
        where: { clientId: data.clientId, deletedAt: null },
        select: { clientId: true },
      });
      if (!client) throw new ApiError(400, "Client not found");
    }

    // A walk-in cannot be chased for payment later, so a due date on one is
    // meaningless and is refused rather than silently kept.
    if (data.clientId === undefined && data.dueDate) {
      throw new ApiError(
        400,
        "A walk-in has no account to bill later, so it cannot have a due date",
      );
    }

    if (data.bookingId !== undefined) {
      const booking = await prisma.booking.findUnique({
        where: { bookingId: data.bookingId },
        select: { bookingId: true },
      });
      if (!booking) throw new ApiError(400, "Booking not found");
    }

    const invoice = await prisma.invoice.create({
      data: {
        clientId: data.clientId ?? null,
        bookingId: data.bookingId,
        dueDate: data.dueDate,
        ...(data.discountPct !== undefined
          ? { discountPct: data.discountPct }
          : {}),
        ...(data.taxPct !== undefined ? { taxPct: data.taxPct } : {}),
        notes: data.notes,
        status: "Draft",
      },
      include: invoiceInclude,
    });

    await writeAudit(session, {
      action: "create",
      entity: "invoice",
      entityId: invoice.invoiceId,
      changes: {
        clientId: data.clientId,
        bookingId: data.bookingId,
        dueDate: data.dueDate,
      },
    });

    return NextResponse.json(
      { invoice: toInvoiceDTO(invoice) },
      { status: 201 },
    );
  });
}
