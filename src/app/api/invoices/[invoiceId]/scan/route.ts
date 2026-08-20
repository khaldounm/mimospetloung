import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import {
  invoiceInclude,
  recomputeInvoiceTotals,
  toInvoiceDTO,
} from "@/lib/invoices";
import { writeAudit } from "@/lib/audit";
import { lineItemScanSchema } from "@/schemas/invoice";
import { gtinLookupCandidates } from "@/utils/barcode";

// One scan at the counter. Separate from POST /line-items because a scan is an
// event, not a form submission: it carries a barcode rather than an item id,
// and scanning the same product twice means "two of them", not two lines.
//
// Resolving the code and deciding increment-or-create both happen here, inside
// one transaction, so rapid scans of the same item cannot interleave into
// duplicate rows.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const { invoiceId: raw } = await params;
    const invoiceId = Number(raw);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      throw new ApiError(400, "Invalid id");
    }

    const data = await parseBody(request, lineItemScanSchema);

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId },
      select: { status: true },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status !== "Draft") {
      throw new ApiError(409, "Lines can only be changed on a draft invoice");
    }

    // The same GTIN is stored padded or unpadded depending on where it came
    // from, so match against every equivalent form. See gtinLookupCandidates.
    const item = await prisma.inventoryItem.findFirst({
      where: {
        deletedAt: null,
        barcode: { in: gtinLookupCandidates(data.barcode) },
      },
      select: { itemId: true, name: true, salePrice: true },
    });
    if (!item) {
      throw new ApiError(404, `No item matches barcode ${data.barcode}`);
    }
    if (item.salePrice == null) {
      throw new ApiError(400, `${item.name} has no sale price set`);
    }
    // Bound outside the transaction callback so the null check above narrows.
    const unitPrice = item.salePrice;

    const { updated, lineItemId, created } = await prisma.$transaction(
      async (tx) => {
        // Scanning a product that is already on the invoice bumps its quantity.
        // Only lines still priced at the item's current sale price are merged
        // into; a line whose price was overridden by hand is left alone so the
        // scan cannot silently reprice it.
        const existing = await tx.invoiceLineItem.findFirst({
          where: {
            invoiceId,
            itemId: item.itemId,
            unitPrice,
          },
          orderBy: { lineItemId: "asc" },
        });

        const line = existing
          ? await tx.invoiceLineItem.update({
              where: { lineItemId: existing.lineItemId },
              data: { quantity: { increment: data.quantity } },
            })
          : await tx.invoiceLineItem.create({
              data: {
                invoiceId,
                itemId: item.itemId,
                description: item.name,
                quantity: data.quantity,
                unitPrice,
              },
            });

        await recomputeInvoiceTotals(tx, invoiceId);
        const inv = await tx.invoice.findUnique({
          where: { invoiceId },
          include: invoiceInclude,
        });
        return {
          updated: inv,
          lineItemId: line.lineItemId,
          created: !existing,
        };
      },
    );

    await writeAudit(session, {
      action: created ? "create" : "update",
      entity: "invoice_line_item",
      entityId: lineItemId,
      changes: {
        invoiceId,
        via: "scan",
        barcode: data.barcode,
        itemId: item.itemId,
        quantity: data.quantity,
      },
    });

    return NextResponse.json(
      { invoice: toInvoiceDTO(updated!), itemName: item.name, created },
      { status: created ? 201 : 200 },
    );
  });
}
