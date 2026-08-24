import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import {
  formatInvoiceNumber,
  invoiceInclude,
  recomputeInvoiceTotals,
} from "@/lib/invoices";
import { toDateOnly } from "@/utils/format";
import type { ReturnableInvoiceDTO, ReturnableLineDTO } from "@/types/entities";
import type { InvoiceStatus } from "@/types/enums";

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);

// An invoice can only be returned against once it has actually been raised.
// Draft never sold anything, and Void unsold whatever it did.
const RETURNABLE_FROM: InvoiceStatus[] = [
  "Issued",
  "Partial",
  "Paid",
  "Overdue",
];

// Return lines already claimed against a sale, wherever they sit. Draft ones
// count: a return sitting in an unissued basket is a claim on that stock, and
// ignoring it would let the same tin be returned twice by opening two drafts.
// Void ones do not, because voiding gave the claim back.
const CLAIMED_BY: Prisma.InvoiceLineItemWhereInput = {
  invoice: { status: { not: "Void" } },
};

// ---- Reads ----

// The Sold movement each line wrote when the invoice was issued, keyed by line.
//
// A movement records the item, not the line, so duplicate lines for one item are
// matched in order: issueInvoice writes them in line order, so the nth movement
// for an item belongs to the nth line for it. Same pairing voidInvoice relies on.
async function soldMovementByLine(
  tx: Prisma.TransactionClient | typeof prisma,
  invoiceId: number,
  lines: { lineItemId: number; itemId: number | null }[],
) {
  const moves = await tx.inventoryTransaction.findMany({
    where: { referenceType: "invoice", referenceId: invoiceId, type: "Sold" },
    orderBy: { transactionId: "asc" },
    select: {
      transactionId: true,
      itemId: true,
      unitCost: true,
      salePrice: true,
      partnerId: true,
      partnerPayable: true,
      batchMovements: {
        select: { batch: { select: { lotNumber: true, expiryDate: true } } },
      },
    },
  });

  const queued = new Map<number, typeof moves>();
  for (const m of moves) {
    const q = queued.get(m.itemId) ?? [];
    q.push(m);
    queued.set(m.itemId, q);
  }

  const byLine = new Map<number, (typeof moves)[number]>();
  for (const line of lines) {
    if (line.itemId == null) continue;
    const next = queued.get(line.itemId)?.shift();
    if (next) byLine.set(line.lineItemId, next);
  }
  return byLine;
}

// What is still returnable on an invoice, line by line, with the lot each line's
// stock came out of so the counter can put it back where it belongs.
export async function listReturnable(
  invoiceId: number,
): Promise<ReturnableInvoiceDTO> {
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: {
      client: { select: { firstName: true, lastName: true } },
      lineItems: {
        // Only a sale can be given back. A return line is already a giving-back.
        where: { quantity: { gt: 0 } },
        orderBy: { lineItemId: "asc" },
        include: {
          item: { select: { tracksExpiry: true } },
        },
      },
    },
  });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (!RETURNABLE_FROM.includes(invoice.status as InvoiceStatus)) {
    throw new ApiError(
      409,
      invoice.status === "Draft"
        ? "This invoice has not been issued, so nothing has been sold to return. Edit the draft instead."
        : "This invoice is void, so there is nothing to return against it.",
    );
  }

  const lineIds = invoice.lineItems.map((l) => l.lineItemId);
  const claimed = await prisma.invoiceLineItem.groupBy({
    by: ["returnedFromLineId"],
    where: { returnedFromLineId: { in: lineIds }, ...CLAIMED_BY },
    _sum: { quantity: true },
  });
  const claimedBy = new Map(
    claimed.map((c) => [c.returnedFromLineId!, c._sum.quantity ?? D(0)]),
  );

  const sold = await soldMovementByLine(prisma, invoiceId, invoice.lineItems);

  const lines: ReturnableLineDTO[] = invoice.lineItems.map((l) => {
    // Claimed quantities are stored negative, so this is a magnitude.
    const returned = (claimedBy.get(l.lineItemId) ?? D(0)).abs();
    const returnable = Prisma.Decimal.max(l.quantity.minus(returned), 0);
    // The lot the sale drew from. A sale that spanned two lots offers the first
    // it touched, which is the one FEFO emptied and the likeliest to be the box
    // in the customer's hand; whoever takes the return can override it.
    const batch = sold.get(l.lineItemId)?.batchMovements[0]?.batch;
    return {
      lineItemId: l.lineItemId,
      description: l.description,
      itemId: l.itemId,
      serviceId: l.serviceId,
      unitPrice: l.unitPrice.toString(),
      quantitySold: l.quantity.toString(),
      quantityReturned: returned.toString(),
      quantityReturnable: returnable.toString(),
      looseUnit: l.looseUnit,
      tracksExpiry: l.item?.tracksExpiry ?? false,
      suggestedLotNumber: batch?.lotNumber ?? null,
      suggestedExpiryDate: toDateOnly(batch?.expiryDate ?? null),
    };
  });

  return {
    invoiceId: invoice.invoiceId,
    number: formatInvoiceNumber(invoice.invoiceId),
    clientId: invoice.clientId,
    clientName: invoice.client
      ? `${invoice.client.firstName} ${invoice.client.lastName}`
      : "Walk-in",
    status: invoice.status as InvoiceStatus,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    lines,
  };
}

// ---- Write ----

export interface ReturnEntry {
  sourceLineItemId: number;
  // A magnitude, in the same units as the line being returned. The sign is put
  // on by this module and never by the caller.
  quantity: number;
  // True puts the goods back on the shelf, false writes them off. Required, with
  // no default: guessing this either invents stock the clinic cannot sell or
  // bins stock it can.
  restock: boolean;
  lotNumber?: string | null;
  expiryDate?: Date | null;
}

// Add return lines to a draft invoice.
//
// A return is an ordinary line with a negative quantity and an unchanged price,
// which is the same rule the purchase side has followed since supplier returns
// landed and the same one the old system used for its 85 customer returns. That
// is deliberate: it means the return rides the existing draft, issue, pay and
// print pipeline rather than needing a parallel one, and it lets ONE document
// hold the bag coming back and the bag going out, which is how an exchange
// actually happens at the counter.
export async function addReturnLines(
  targetInvoiceId: number,
  entries: ReturnEntry[],
) {
  if (entries.length === 0) throw new ApiError(400, "Nothing to return");

  return prisma.$transaction(async (tx) => {
    const target = await tx.invoice.findUnique({
      where: { invoiceId: targetInvoiceId },
      select: { invoiceId: true, status: true, clientId: true },
    });
    if (!target) throw new ApiError(404, "Invoice not found");
    if (target.status !== "Draft") {
      throw new ApiError(
        409,
        "Returns can only be added to a draft invoice. Start a new one for this return.",
      );
    }

    const sourceLines = await tx.invoiceLineItem.findMany({
      where: { lineItemId: { in: entries.map((e) => e.sourceLineItemId) } },
      include: {
        invoice: { select: { invoiceId: true, status: true, clientId: true } },
        item: { select: { name: true, tracksExpiry: true } },
      },
    });
    const byId = new Map(sourceLines.map((l) => [l.lineItemId, l]));

    // One query for every source line's outstanding claims, rather than one per
    // entry inside the loop.
    const claimed = await tx.invoiceLineItem.groupBy({
      by: ["returnedFromLineId"],
      where: {
        returnedFromLineId: { in: entries.map((e) => e.sourceLineItemId) },
        ...CLAIMED_BY,
      },
      _sum: { quantity: true },
    });
    const claimedBy = new Map(
      claimed.map((c) => [
        c.returnedFromLineId!,
        (c._sum.quantity ?? D(0)).abs(),
      ]),
    );

    for (const entry of entries) {
      const source = byId.get(entry.sourceLineItemId);
      if (!source) {
        throw new ApiError(404, `Line ${entry.sourceLineItemId} was not found`);
      }
      if (source.invoiceId === targetInvoiceId) {
        throw new ApiError(
          409,
          "An invoice cannot return its own lines. Void it instead.",
        );
      }
      if (!RETURNABLE_FROM.includes(source.invoice.status as InvoiceStatus)) {
        throw new ApiError(
          409,
          `${formatInvoiceNumber(source.invoiceId)} is ${source.invoice.status.toLowerCase()}, so nothing was sold on it to return.`,
        );
      }
      if (source.quantity.lessThanOrEqualTo(0)) {
        throw new ApiError(
          409,
          `"${source.description}" is itself a return and cannot be returned again.`,
        );
      }
      // Crediting one account for another's purchase is a real and expensive
      // mistake, so the return has to land where the sale did. Two walk-ins are
      // both null and match, which is correct: neither has an account.
      if (source.invoice.clientId !== target.clientId) {
        throw new ApiError(
          409,
          "This return belongs to a different customer than the invoice it is being added to.",
        );
      }

      const quantity = D(entry.quantity);
      if (quantity.lessThanOrEqualTo(0)) {
        throw new ApiError(400, "A return quantity must be more than zero");
      }
      const remaining = source.quantity.minus(
        claimedBy.get(entry.sourceLineItemId) ?? D(0),
      );
      if (quantity.greaterThan(remaining)) {
        throw new ApiError(
          409,
          `Only ${remaining.toString()} of "${source.description}" is still returnable: ${source.quantity.toString()} was sold and the rest has already come back.`,
        );
      }

      // A perishable has to go back into a dated lot. Undated stock sorts first
      // in FEFO, so accepting a return without a date would push it out of the
      // door ahead of stock whose expiry is known.
      if (source.item?.tracksExpiry && !entry.expiryDate) {
        throw new ApiError(
          400,
          `"${source.item.name}" is tracked by expiry, so this return needs the date off the pack.`,
        );
      }

      // What the customer asked for on a loose sale, cut to the share coming
      // back, so the printed credit reads in the same units the sale did.
      const looseQty =
        source.looseQty != null && source.quantity.greaterThan(0)
          ? source.looseQty
              .times(quantity)
              .dividedBy(source.quantity)
              .toDecimalPlaces(3)
              .negated()
          : null;

      await tx.invoiceLineItem.create({
        data: {
          invoiceId: targetInvoiceId,
          serviceId: source.serviceId,
          itemId: source.itemId,
          description: `Return: ${source.description}`.slice(0, 255),
          // The sign lives here and nowhere else: the price stays what it was,
          // so line_total comes out negative on its own and every total, balance
          // and statement downstream nets it without a special case.
          quantity: quantity.negated(),
          unitPrice: source.unitPrice,
          looseQty,
          looseUnit: source.looseUnit,
          returnedFromLineId: source.lineItemId,
          returnRestock: entry.restock,
          returnLotNumber: entry.lotNumber ?? null,
          returnExpiryDate: entry.expiryDate ?? null,
        },
      });

      // Keep the running total honest across several entries against one line.
      claimedBy.set(
        entry.sourceLineItemId,
        (claimedBy.get(entry.sourceLineItemId) ?? D(0)).plus(quantity),
      );
    }

    await recomputeInvoiceTotals(tx, targetInvoiceId);
    return tx.invoice.findUniqueOrThrow({
      where: { invoiceId: targetInvoiceId },
      include: invoiceInclude,
    });
  });
}
