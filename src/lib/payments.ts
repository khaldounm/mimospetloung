import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { CURRENCY } from "@/constants/clinic";
import type { PaymentMethod } from "@/types/enums";

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);

// One leg of a settlement. Cash comes over the counter as some dollars and the
// rest in lira, and each currency is kept as its own row carrying what was
// physically handed over plus the rate used, so the drawer can be counted at
// close while `usd` stays the ledger figure.
export interface Tender {
  currency: string;
  // A POSITIVE magnitude, in that currency. Not the cash handed over: change is
  // given back at the counter and never reaches the ledger.
  //
  // Direction is never sent. Whether a settlement takes money in or hands it
  // back is decided server-side, so the counter types an amount and cannot get
  // the sign backwards on the one transaction where doing so would take money
  // off a customer who came in to be paid.
  amount: number;
}

export interface TenderLeg {
  currency: string;
  original: Prisma.Decimal;
  usd: Prisma.Decimal;
}

// Convert what was handed over into ledger legs. `sign` points them: 1 takes
// money in, -1 hands it back on a refund.
export function buildTenderLegs(
  tenders: Tender[],
  fxRate: Prisma.Decimal,
  sign: number,
): TenderLeg[] {
  return tenders
    .filter((t) => t.amount > 0)
    .map((t) => {
      const magnitude = D(t.amount).toDecimalPlaces(2);
      const usd =
        t.currency === CURRENCY.code
          ? magnitude
          : magnitude.dividedBy(fxRate).toDecimalPlaces(2);
      return {
        currency: t.currency,
        original: magnitude.times(sign),
        usd: usd.times(sign),
      };
    });
}

// Converting lira to dollars rounds, so a settlement meant to clear a balance
// exactly can land a cent over it. Absorb that on the last leg rather than
// rejecting a payment the counter got right.
export function absorbRoundingOvershoot(
  legs: TenderLeg[],
  amount: Prisma.Decimal,
  target: Prisma.Decimal,
  direction: number,
): Prisma.Decimal {
  const overshoot = amount.abs().minus(target.abs());
  if (overshoot.gt(0) && overshoot.lte(D("0.01"))) {
    const last = legs[legs.length - 1]!;
    last.usd = last.usd.minus(overshoot.times(direction));
    return target;
  }
  return amount;
}

// Money taken against a client's account with no invoice behind it: the
// customer who walks in purely to pay off what they owe, and the deposit taken
// before there is anything to bill.
//
// This is the only way to clear debt that no open invoice covers, which is all
// of it for anything carried over from the old system: those invoices came
// across already marked paid, and the balance lives on the account alone.
//
// Deliberately NOT an invoice. Issuing one would raise the account by its own
// total, so the payment would clear only the document it just created and leave
// the original debt exactly where it was, with a phantom sale in the revenue
// reports for good measure.
export async function recordAccountPayment(
  clientId: number,
  data: {
    tenders: Tender[];
    // LBP per 1 USD, used to convert the lira legs.
    fxRate: number;
    method?: PaymentMethod;
    reference?: string;
    paidAt?: Date;
    notes?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { clientId },
      select: { clientId: true, deletedAt: true, accountBalance: true },
    });
    if (!client || client.deletedAt)
      throw new ApiError(404, "Client not found");

    const owed = client.accountBalance;
    if (owed.lte(0)) {
      throw new ApiError(
        400,
        owed.isZero()
          ? "This account is already settled."
          : `This account is in credit by ${owed.abs().toFixed(2)}. There is nothing to pay.`,
      );
    }

    const fxRate = D(data.fxRate);
    if (fxRate.lte(0)) throw new ApiError(400, "Invalid exchange rate");

    // Only ever takes money in. Handing money back to a client sitting in
    // credit is a refund against the document that created it, not a negative
    // payment invented on the account.
    const legs = buildTenderLegs(data.tenders, fxRate, 1);
    if (legs.length === 0) throw new ApiError(400, "Enter an amount");

    let amount = legs.reduce((sum, l) => sum.plus(l.usd), D(0));
    amount = absorbRoundingOvershoot(legs, amount, owed, 1);
    if (amount.gt(owed)) {
      throw new ApiError(
        400,
        `Payment exceeds the ${owed.toFixed(2)} outstanding on this account`,
      );
    }

    const paidAt = data.paidAt ?? new Date();
    const payments = [];
    for (const leg of legs) {
      payments.push(
        await tx.payment.create({
          data: {
            clientId,
            // No invoice: this money answers to the account itself. It still
            // counts as cash taken, so the drawer and collected revenue both
            // pick it up, neither of which joins through the invoice.
            invoiceId: null,
            amount: leg.usd,
            currency: leg.currency,
            amountOriginal: leg.original,
            fxRate: leg.currency === CURRENCY.code ? null : fxRate,
            method: data.method ?? null,
            reference: data.reference,
            paidAt,
            notes: data.notes,
          },
        }),
      );
    }

    const updated = await tx.client.update({
      where: { clientId },
      data: { accountBalance: { decrement: amount } },
      select: { accountBalance: true },
    });

    return {
      payments,
      amount,
      balanceBefore: owed,
      balanceAfter: updated.accountBalance,
    };
  });
}
