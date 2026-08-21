import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import {
  invoiceInclude,
  recomputeInvoiceTotals,
  resolveLine,
  toInvoiceDTO,
} from "@/lib/invoices";
import { writeAudit } from "@/lib/audit";
import { lineItemCreateSchema } from "@/schemas/invoice";

async function getInvoiceId(params: Promise<{ invoiceId: string }>) {
  const { invoiceId } = await params;
  const id = Number(invoiceId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const invoiceId = await getInvoiceId(params);
    const data = await parseBody(request, lineItemCreateSchema);

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId },
      select: { status: true },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status !== "Draft") {
      throw new ApiError(409, "Lines can only be changed on a draft invoice");
    }

    // Snapshot the label + price from the source, allowing caller overrides.
    let description = data.description;
    let unitPrice = data.unitPrice;
    // Filled from the item when the line is sold loose, so the pack quantity
    // and the price are derived from the item's own configuration.
    let resolved = resolveLine(null, { quantity: data.quantity ?? 1 });

    if (data.serviceId !== undefined) {
      const service = await prisma.service.findUnique({
        where: { serviceId: data.serviceId },
        select: { name: true, price: true },
      });
      if (!service) throw new ApiError(400, "Service not found");
      description = description ?? service.name;
      unitPrice = unitPrice ?? service.price.toNumber();
    } else if (data.itemId !== undefined) {
      const item = await prisma.inventoryItem.findFirst({
        where: { itemId: data.itemId, deletedAt: null },
        select: {
          name: true,
          salePrice: true,
          looseUnit: true,
          loosePerUnit: true,
          loosePrice: true,
        },
      });
      if (!item) throw new ApiError(400, "Inventory item not found");
      description = description ?? item.name;
      resolved = resolveLine(item, data);
      unitPrice =
        resolved.unitPrice ??
        (item.salePrice ? item.salePrice.toNumber() : undefined);
    }

    if (unitPrice === undefined) {
      throw new ApiError(400, "A unit price is required");
    }
    if (!description) {
      throw new ApiError(400, "A description is required");
    }

    const { updated, lineItemId } = await prisma.$transaction(async (tx) => {
      const line = await tx.invoiceLineItem.create({
        data: {
          invoiceId,
          serviceId: data.serviceId,
          itemId: data.itemId,
          description,
          quantity: resolved.quantity,
          unitPrice,
          looseQty: resolved.looseQty,
          looseUnit: resolved.looseUnit,
        },
      });
      await recomputeInvoiceTotals(tx, invoiceId);
      const inv = await tx.invoice.findUnique({
        where: { invoiceId },
        include: invoiceInclude,
      });
      return { updated: inv, lineItemId: line.lineItemId };
    });

    await writeAudit(session, {
      action: "create",
      entity: "invoice_line_item",
      entityId: lineItemId,
      changes: {
        invoiceId,
        description,
        quantity: resolved.quantity,
        unitPrice,
        ...(resolved.looseQty != null
          ? { looseQty: resolved.looseQty, looseUnit: resolved.looseUnit }
          : {}),
      },
    });

    return NextResponse.json(
      { invoice: toInvoiceDTO(updated!) },
      { status: 201 },
    );
  });
}
