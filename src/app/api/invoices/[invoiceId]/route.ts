import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, requirePermission } from "@/lib/api";
import {
  invoiceInclude,
  issueInvoice,
  recomputeInvoiceTotals,
  toInvoiceDTO,
  voidInvoice,
} from "@/lib/invoices";
import {
  invoiceTransitionSchema,
  invoiceUpdateSchema,
} from "@/schemas/invoice";
import { writeAudit } from "@/lib/audit";

async function getInvoiceId(params: Promise<{ invoiceId: string }>) {
  const { invoiceId } = await params;
  const id = Number(invoiceId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    await requirePermission("invoices:read");
    const invoiceId = await getInvoiceId(params);

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId },
      include: invoiceInclude,
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");

    return NextResponse.json({ invoice: toInvoiceDTO(invoice) });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const invoiceId = await getInvoiceId(params);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new ApiError(400, "Invalid JSON body");
    }

    // A `status` field means a lifecycle transition (Issue/Void); anything else
    // is a draft field edit.
    if (raw && typeof raw === "object" && "status" in raw) {
      const parsed = invoiceTransitionSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ApiError(400, parsed.error.issues[0].message);
      }
      const performedBy = session.user.userId;
      const invoice =
        parsed.data.status === "Issued"
          ? await issueInvoice(invoiceId, performedBy)
          : await voidInvoice(invoiceId, performedBy);
      await writeAudit(session, {
        action: parsed.data.status === "Issued" ? "issue" : "void",
        entity: "invoice",
        entityId: invoiceId,
        changes: { status: invoice.status },
      });
      return NextResponse.json({ invoice: toInvoiceDTO(invoice) });
    }

    const parsed = invoiceUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const path = first.path.join(".");
      throw new ApiError(
        400,
        path ? `${path}: ${first.message}` : first.message,
      );
    }
    const data = parsed.data;

    const existing = await prisma.invoice.findUnique({
      where: { invoiceId },
      select: { status: true },
    });
    if (!existing) throw new ApiError(404, "Invoice not found");
    if (existing.status !== "Draft") {
      throw new ApiError(409, "Only draft invoices can be edited");
    }

    if (data.clientId !== undefined) {
      const client = await prisma.client.findFirst({
        where: { clientId: data.clientId, deletedAt: null },
        select: { clientId: true },
      });
      if (!client) throw new ApiError(400, "Client not found");
    }

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { invoiceId },
        data: {
          ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
          ...(data.bookingId !== undefined
            ? { bookingId: data.bookingId }
            : {}),
          ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
          ...(data.discountPct !== undefined
            ? { discountPct: data.discountPct }
            : {}),
          ...(data.taxPct !== undefined ? { taxPct: data.taxPct } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      });
      // Discount/tax changes shift the snapshot even with the same lines.
      await recomputeInvoiceTotals(tx, invoiceId);
      return tx.invoice.findUnique({
        where: { invoiceId },
        include: invoiceInclude,
      });
    });

    await writeAudit(session, {
      action: "update",
      entity: "invoice",
      entityId: invoiceId,
      changes: data,
    });

    return NextResponse.json({ invoice: toInvoiceDTO(invoice!) });
  });
}
