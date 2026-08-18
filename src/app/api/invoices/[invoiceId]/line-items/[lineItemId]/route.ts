import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import {
  invoiceInclude,
  recomputeInvoiceTotals,
  toInvoiceDTO,
} from "@/lib/invoices";
import { writeAudit } from "@/lib/audit";
import { lineItemUpdateSchema } from "@/schemas/invoice";

async function getIds(
  params: Promise<{ invoiceId: string; lineItemId: string }>,
) {
  const { invoiceId, lineItemId } = await params;
  const invId = Number(invoiceId);
  const lineId = Number(lineItemId);
  if (!Number.isInteger(invId) || invId <= 0)
    throw new ApiError(400, "Invalid id");
  if (!Number.isInteger(lineId) || lineId <= 0)
    throw new ApiError(400, "Invalid id");
  return { invoiceId: invId, lineItemId: lineId };
}

// Confirms the line belongs to a draft invoice; returns the line.
async function loadDraftLine(invoiceId: number, lineItemId: number) {
  const line = await prisma.invoiceLineItem.findUnique({
    where: { lineItemId },
    include: { invoice: { select: { invoiceId: true, status: true } } },
  });
  if (!line || line.invoiceId !== invoiceId) {
    throw new ApiError(404, "Line item not found");
  }
  if (line.invoice.status !== "Draft") {
    throw new ApiError(409, "Lines can only be changed on a draft invoice");
  }
  return line;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string; lineItemId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const { invoiceId, lineItemId } = await getIds(params);
    const data = await parseBody(request, lineItemUpdateSchema);

    await loadDraftLine(invoiceId, lineItemId);

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.update({
        where: { lineItemId },
        data: {
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
          ...(data.unitPrice !== undefined
            ? { unitPrice: data.unitPrice }
            : {}),
        },
      });
      await recomputeInvoiceTotals(tx, invoiceId);
      return tx.invoice.findUnique({
        where: { invoiceId },
        include: invoiceInclude,
      });
    });

    await writeAudit(session, {
      action: "update",
      entity: "invoice_line_item",
      entityId: lineItemId,
      changes: { invoiceId, ...data },
    });

    return NextResponse.json({ invoice: toInvoiceDTO(invoice!) });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string; lineItemId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const { invoiceId, lineItemId } = await getIds(params);

    await loadDraftLine(invoiceId, lineItemId);

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.delete({ where: { lineItemId } });
      await recomputeInvoiceTotals(tx, invoiceId);
      return tx.invoice.findUnique({
        where: { invoiceId },
        include: invoiceInclude,
      });
    });

    await writeAudit(session, {
      action: "delete",
      entity: "invoice_line_item",
      entityId: lineItemId,
      changes: { invoiceId },
    });

    return NextResponse.json({ invoice: toInvoiceDTO(invoice!) });
  });
}
