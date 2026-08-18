import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import {
  invoiceInclude,
  invoiceListInclude,
  toInvoiceDTO,
  toInvoiceListItemDTO,
} from "@/lib/invoices";
import { writeAudit } from "@/lib/audit";
import { invoiceCreateSchema } from "@/schemas/invoice";
import { INVOICE_STATUSES } from "@/types/enums";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("invoices:read");

    const sp = new URL(request.url).searchParams;
    const status = sp.get("status")?.trim();
    const clientIdRaw = sp.get("clientId")?.trim();
    const clientId = clientIdRaw ? Number(clientIdRaw) : undefined;

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(status && (INVOICE_STATUSES as readonly string[]).includes(status)
          ? { status }
          : {}),
        ...(clientId && Number.isInteger(clientId) ? { clientId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: invoiceListInclude,
    });

    return NextResponse.json({
      invoices: invoices.map(toInvoiceListItemDTO),
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const data = await parseBody(request, invoiceCreateSchema);

    // Validate the client exists and is not deleted.
    const client = await prisma.client.findFirst({
      where: { clientId: data.clientId, deletedAt: null },
      select: { clientId: true },
    });
    if (!client) throw new ApiError(400, "Client not found");

    if (data.bookingId !== undefined) {
      const booking = await prisma.booking.findUnique({
        where: { bookingId: data.bookingId },
        select: { bookingId: true },
      });
      if (!booking) throw new ApiError(400, "Booking not found");
    }

    const invoice = await prisma.invoice.create({
      data: {
        clientId: data.clientId,
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
