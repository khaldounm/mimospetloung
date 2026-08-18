import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { isStockCheckViolation } from "@/lib/inventory";
import { computePartnerPayable, effectiveSharePct } from "@/lib/partners";
import { toDateOnly } from "@/utils/format";
import type {
  InvoiceDTO,
  InvoiceLineItemDTO,
  InvoiceListItemDTO,
  PaymentDTO,
  ServiceDTO,
} from "@/types/entities";
import type { InvoiceStatus, PaymentMethod } from "@/types/enums";

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);
const HUNDRED = D(100);

// Human-facing invoice number. The DB has no separate number column, so the
// immutable invoice_id is the canonical number, zero-padded for display.
export function formatInvoiceNumber(invoiceId: number): string {
  return `INV-${String(invoiceId).padStart(5, "0")}`;
}

// ---- Row shapes ----

type ServiceRow = {
  serviceId: number;
  name: string;
  category: string | null;
  price: Prisma.Decimal;
  isActive: boolean;
  description: string | null;
};

type LineItemRow = {
  lineItemId: number;
  invoiceId: number;
  serviceId: number | null;
  itemId: number | null;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

type PaymentRow = {
  paymentId: number;
  invoiceId: number;
  amount: Prisma.Decimal;
  method: string | null;
  reference: string | null;
  paidAt: Date;
  notes: string | null;
};

type InvoiceRow = {
  invoiceId: number;
  clientId: number;
  bookingId: number | null;
  status: string;
  subtotal: Prisma.Decimal;
  discountPct: Prisma.Decimal;
  taxPct: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  issuedAt: Date | null;
  dueDate: Date | null;
  notes: string | null;
  createdAt: Date;
  client: { firstName: string; lastName: string; phone: string | null };
  lineItems: LineItemRow[];
  payments: PaymentRow[];
};

type InvoiceListRow = {
  invoiceId: number;
  status: string;
  total: Prisma.Decimal;
  issuedAt: Date | null;
  dueDate: Date | null;
  client: { firstName: string; lastName: string };
  payments: { amount: Prisma.Decimal }[];
};

// Includes that produce the rows above.
export const invoiceInclude = {
  client: { select: { firstName: true, lastName: true, phone: true } },
  lineItems: { orderBy: { lineItemId: "asc" } },
  payments: { orderBy: { paidAt: "asc" } },
} as const;

export const invoiceListInclude = {
  client: { select: { firstName: true, lastName: true } },
  payments: { select: { amount: true } },
} as const;

// ---- Money math ----

// Compute the frozen money snapshot from line totals + the invoice's discount
// and tax percentages. All values rounded to 2 dp.
export function computeTotals(
  lineTotals: Prisma.Decimal[],
  discountPct: Prisma.Decimal,
  taxPct: Prisma.Decimal,
): {
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
} {
  const subtotal = lineTotals
    .reduce((sum, lt) => sum.plus(lt), D(0))
    .toDecimalPlaces(2);
  const discountAmount = subtotal.times(discountPct).dividedBy(HUNDRED);
  const taxable = subtotal.minus(discountAmount);
  const taxAmount = taxable.times(taxPct).dividedBy(HUNDRED).toDecimalPlaces(2);
  const total = taxable.plus(taxAmount).toDecimalPlaces(2);
  return { subtotal, taxAmount, total };
}

function sumPaid(payments: { amount: Prisma.Decimal }[]): Prisma.Decimal {
  return payments
    .reduce((sum, p) => sum.plus(p.amount), D(0))
    .toDecimalPlaces(2);
}

function isOverdue(
  status: string,
  dueDate: Date | null,
  balance: Prisma.Decimal,
): boolean {
  if (status !== "Issued" && status !== "Partial") return false;
  if (!dueDate || balance.lte(0)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate.getTime() < today.getTime();
}

// ---- DTO mappers ----

export function toServiceDTO(s: ServiceRow): ServiceDTO {
  return {
    serviceId: s.serviceId,
    name: s.name,
    category: s.category,
    price: s.price.toFixed(2),
    isActive: s.isActive,
    description: s.description,
  };
}

export function toLineItemDTO(l: LineItemRow): InvoiceLineItemDTO {
  return {
    lineItemId: l.lineItemId,
    invoiceId: l.invoiceId,
    serviceId: l.serviceId,
    itemId: l.itemId,
    description: l.description,
    quantity: l.quantity.toString(),
    unitPrice: l.unitPrice.toFixed(2),
    lineTotal: l.lineTotal.toFixed(2),
  };
}

export function toPaymentDTO(p: PaymentRow): PaymentDTO {
  return {
    paymentId: p.paymentId,
    invoiceId: p.invoiceId,
    amount: p.amount.toFixed(2),
    method: (p.method as PaymentMethod | null) ?? null,
    reference: p.reference,
    paidAt: p.paidAt.toISOString(),
    notes: p.notes,
  };
}

export function toInvoiceDTO(i: InvoiceRow): InvoiceDTO {
  const amountPaid = sumPaid(i.payments);
  const balance = i.total.minus(amountPaid).toDecimalPlaces(2);
  return {
    invoiceId: i.invoiceId,
    number: formatInvoiceNumber(i.invoiceId),
    clientId: i.clientId,
    clientName: `${i.client.firstName} ${i.client.lastName}`,
    clientPhone: i.client.phone,
    bookingId: i.bookingId,
    status: i.status as InvoiceStatus,
    subtotal: i.subtotal.toFixed(2),
    discountPct: i.discountPct.toString(),
    taxPct: i.taxPct.toString(),
    taxAmount: i.taxAmount.toFixed(2),
    total: i.total.toFixed(2),
    amountPaid: amountPaid.toFixed(2),
    balance: balance.toFixed(2),
    issuedAt: i.issuedAt ? i.issuedAt.toISOString() : null,
    dueDate: toDateOnly(i.dueDate),
    notes: i.notes,
    createdAt: i.createdAt.toISOString(),
    isOverdue: isOverdue(i.status, i.dueDate, balance),
    lineItems: i.lineItems.map(toLineItemDTO),
    payments: i.payments.map(toPaymentDTO),
  };
}

export function toInvoiceListItemDTO(i: InvoiceListRow): InvoiceListItemDTO {
  const amountPaid = sumPaid(i.payments);
  const balance = i.total.minus(amountPaid).toDecimalPlaces(2);
  return {
    invoiceId: i.invoiceId,
    number: formatInvoiceNumber(i.invoiceId),
    clientName: `${i.client.firstName} ${i.client.lastName}`,
    status: i.status as InvoiceStatus,
    total: i.total.toFixed(2),
    amountPaid: amountPaid.toFixed(2),
    balance: balance.toFixed(2),
    issuedAt: i.issuedAt ? i.issuedAt.toISOString() : null,
    dueDate: toDateOnly(i.dueDate),
    isOverdue: isOverdue(i.status, i.dueDate, balance),
  };
}

export function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

// ---- Mutations ----

type Tx = Prisma.TransactionClient;

// Recompute and persist the money snapshot from current line items. Used while
// a draft is edited and again at issue time. The DB generates line_total, so we
// read it back rather than recomputing per line.
export async function recomputeInvoiceTotals(
  tx: Tx,
  invoiceId: number,
): Promise<void> {
  const invoice = await tx.invoice.findUnique({
    where: { invoiceId },
    select: { discountPct: true, taxPct: true },
  });
  if (!invoice) throw new ApiError(404, "Invoice not found");

  const lines = await tx.invoiceLineItem.findMany({
    where: { invoiceId },
    select: { lineTotal: true },
  });

  const { subtotal, taxAmount, total } = computeTotals(
    lines.map((l) => l.lineTotal),
    invoice.discountPct,
    invoice.taxPct,
  );

  await tx.invoice.update({
    where: { invoiceId },
    data: { subtotal, taxAmount, total },
  });
}

// Issue a draft: freeze totals, decrement stock for inventory lines (recorded as
// 'Sold' movements referencing this invoice), and lock the invoice. All atomic,
// so an oversell rolls the whole issue back.
export async function issueInvoice(
  invoiceId: number,
  performedBy: number | null,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { invoiceId },
        include: {
          lineItems: {
            include: {
              item: {
                select: {
                  name: true,
                  lastCost: true,
                  partnerId: true,
                  partnerSharePct: true,
                  partner: { select: { defaultSharePct: true } },
                },
              },
            },
          },
        },
      });
      if (!invoice) throw new ApiError(404, "Invoice not found");
      if (invoice.status !== "Draft") {
        throw new ApiError(409, "Only draft invoices can be issued");
      }
      if (invoice.lineItems.length === 0) {
        throw new ApiError(400, "Add at least one line item before issuing");
      }

      for (const line of invoice.lineItems) {
        if (line.itemId == null) continue;
        // Stock is tracked to 2 decimals, so fractional sell quantities
        // (e.g. 0.5 vial, 2.5 ml) decrement stock as-is.
        const qty = line.quantity.toNumber();
        const item = line.item;

        // Consigned lines must have a recorded cost: the payout is the partner's
        // cost back plus a share of the profit, so a null lastCost would owe them
        // zero cost back and treat the whole sale as profit. Block the issue so
        // the cost gets set first rather than freezing a wrong accrual.
        if (item?.partnerId != null && item.lastCost == null) {
          throw new ApiError(
            400,
            `Set a last cost on "${item.name}" before issuing: it is consigned from a partner, and the payout is calculated from that cost.`,
          );
        }

        // Consignment: freeze what the clinic owes the sourcing partner for this
        // sale (their cost back + share of profit), mirroring how unitCost is
        // frozen for COGS. Clinic-owned lines leave these null.
        let partnerId: number | null = null;
        let partnerPayable: Prisma.Decimal | null = null;
        if (item?.partnerId != null) {
          partnerId = item.partnerId;
          partnerPayable = computePartnerPayable(
            line.quantity,
            line.unitPrice,
            item.lastCost ?? 0,
            effectiveSharePct(
              item.partnerSharePct,
              item.partner?.defaultSharePct,
            ),
          );
        }

        await tx.inventoryTransaction.create({
          data: {
            itemId: line.itemId,
            performedBy,
            type: "Sold",
            quantity: -qty,
            // Freeze the item's cost at the moment of sale so COGS (and profit)
            // stay accurate even if the purchase cost changes later.
            unitCost: item?.lastCost ?? null,
            // Freeze what it sold for too, so revenue and margin read from the
            // movement rather than needing a join back to this invoice.
            salePrice: line.unitPrice,
            partnerId,
            partnerPayable,
            referenceType: "invoice",
            referenceId: invoiceId,
            notes: `Sold on ${formatInvoiceNumber(invoiceId)}`,
          },
        });
        await tx.inventoryItem.update({
          where: { itemId: line.itemId },
          data: { currentStock: { decrement: qty } },
        });
      }

      await recomputeInvoiceTotals(tx, invoiceId);

      return tx.invoice.update({
        where: { invoiceId },
        data: { status: "Issued", issuedAt: new Date() },
        include: invoiceInclude,
      });
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isStockCheckViolation(err)) {
      throw new ApiError(
        409,
        "Issuing would take an inventory item below zero stock",
      );
    }
    throw err;
  }
}

// Void an invoice. Blocked once any payment exists (handle a refund first). If
// the invoice was already issued, the sold stock is returned via reversing
// 'Adjusted' movements so inventory stays honest.
export async function voidInvoice(
  invoiceId: number,
  performedBy: number | null,
) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { invoiceId },
      include: { lineItems: true, payments: { select: { paymentId: true } } },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status === "Void") {
      throw new ApiError(409, "Invoice is already void");
    }
    if (invoice.payments.length > 0) {
      throw new ApiError(409, "Cannot void an invoice that has payments");
    }

    // Only issued invoices have moved stock; drafts never did.
    if (invoice.status !== "Draft") {
      // Consignment: pull the frozen partner payable from the original Sold
      // movements so the reversal negates it (cancelling what was owed). Queued
      // per item so duplicate item lines each reverse their own accrual.
      const soldMoves = await tx.inventoryTransaction.findMany({
        where: {
          referenceType: "invoice",
          referenceId: invoiceId,
          type: "Sold",
        },
        orderBy: { transactionId: "asc" },
        select: {
          itemId: true,
          partnerId: true,
          partnerPayable: true,
          unitCost: true,
          salePrice: true,
        },
      });
      const soldByItem = new Map<number, typeof soldMoves>();
      for (const m of soldMoves) {
        const queue = soldByItem.get(m.itemId) ?? [];
        queue.push(m);
        soldByItem.set(m.itemId, queue);
      }

      for (const line of invoice.lineItems) {
        if (line.itemId == null) continue;
        const qty = line.quantity.toNumber();
        const sold = soldByItem.get(line.itemId)?.shift();
        await tx.inventoryTransaction.create({
          data: {
            itemId: line.itemId,
            performedBy,
            type: "Adjusted",
            quantity: qty,
            // Carry the frozen cost and sale price from the original Sold
            // movement (positive quantity here) so analytics can net this sale's
            // COGS and revenue back out, mirroring how the negated
            // partnerPayable cancels the accrual.
            unitCost: sold?.unitCost ?? null,
            salePrice: sold?.salePrice ?? null,
            partnerId: sold?.partnerId ?? null,
            partnerPayable:
              sold?.partnerPayable != null
                ? sold.partnerPayable.negated()
                : null,
            referenceType: "invoice",
            referenceId: invoiceId,
            notes: `Restock from voided ${formatInvoiceNumber(invoiceId)}`,
          },
        });
        await tx.inventoryItem.update({
          where: { itemId: line.itemId },
          data: { currentStock: { increment: qty } },
        });
      }
    }

    return tx.invoice.update({
      where: { invoiceId },
      data: { status: "Void" },
      include: invoiceInclude,
    });
  });
}

// Record a payment and derive the new status. Blocks overpayment and payments
// on non-issued invoices.
export async function recordPayment(
  invoiceId: number,
  data: {
    amount: number;
    method?: PaymentMethod;
    reference?: string;
    paidAt?: Date;
    notes?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { invoiceId },
      include: { payments: { select: { amount: true } } },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status !== "Issued" && invoice.status !== "Partial") {
      throw new ApiError(
        409,
        "Payments can only be recorded on issued invoices",
      );
    }

    const alreadyPaid = sumPaid(invoice.payments);
    const balance = invoice.total.minus(alreadyPaid);
    const amount = D(data.amount).toDecimalPlaces(2);
    if (amount.gt(balance)) {
      throw new ApiError(
        400,
        `Payment exceeds the outstanding balance of ${balance.toFixed(2)}`,
      );
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId,
        amount,
        method: data.method ?? null,
        reference: data.reference,
        paidAt: data.paidAt ?? new Date(),
        notes: data.notes,
      },
    });

    const newPaid = alreadyPaid.plus(amount);
    const status: InvoiceStatus = newPaid.gte(invoice.total)
      ? "Paid"
      : "Partial";
    await tx.invoice.update({ where: { invoiceId }, data: { status } });

    const updated = await tx.invoice.findUnique({
      where: { invoiceId },
      include: invoiceInclude,
    });
    return { invoice: updated!, payment };
  });
}
