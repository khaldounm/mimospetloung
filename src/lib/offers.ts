import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { formatInvoiceNumber, recomputeInvoiceTotals } from "@/lib/invoices";
import { toDateOnly } from "@/utils/format";
import { formatLocalDate } from "@/utils/date-range";
import type { OfferDiscountMode } from "@/constants/offers";
import type { CreateOfferInput, UpdateOfferInput } from "@/schemas/offer";
import type {
  OfferDTO,
  OfferGrantDTO,
  OfferGrantResultDTO,
} from "@/types/entities";

// An offer is a deal; a grant is one client holding it; redeeming spends the
// grant against one invoice. Everything here keeps those three apart, because
// collapsing them is exactly what a discount typed onto an invoice already
// does, and it answers none of the questions the clinic is asking.

const offerInclude = {
  _count: {
    select: {
      grants: { where: { redeemedAt: null, revokedAt: null } },
    },
  },
} as const;

// Today as a date-only value, matching how expires_on is stored. Built from
// local parts: an offer runs to the end of its last day in the clinic's own
// timezone, not in UTC.
function todayDateOnly(): Date {
  return new Date(`${formatLocalDate(new Date())}T00:00:00.000Z`);
}

function isExpired(expiresOn: Date | null): boolean {
  return expiresOn != null && expiresOn < todayDateOnly();
}

type OfferRow = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;

export function toOfferDTO(o: OfferRow, redeemedCount: number): OfferDTO {
  return {
    offerId: o.offerId,
    name: o.name,
    discountMode: o.discountMode as OfferDiscountMode,
    discountPct: o.discountPct.toFixed(2),
    discountAmount: o.discountAmount.toFixed(2),
    notes: o.notes,
    expiresOn: toDateOnly(o.expiresOn),
    archived: o.archivedAt != null,
    // An archived or expired offer can still be redeemed by whoever already
    // holds it. What it cannot do is take on anyone new.
    grantable: o.archivedAt == null && !isExpired(o.expiresOn),
    liveCount: o._count.grants,
    redeemedCount,
  };
}

const grantInclude = {
  offer: true,
  client: { select: { firstName: true, lastName: true } },
  granter: { select: { firstName: true, lastName: true } },
} as const;

type GrantRow = Prisma.OfferGrantGetPayload<{ include: typeof grantInclude }>;

export function toGrantDTO(g: GrantRow): OfferGrantDTO {
  return {
    grantId: g.grantId,
    offerId: g.offerId,
    offerName: g.offer.name,
    discountMode: g.offer.discountMode as OfferDiscountMode,
    discountPct: g.offer.discountPct.toFixed(2),
    discountAmount: g.offer.discountAmount.toFixed(2),
    expiresOn: toDateOnly(g.offer.expiresOn),
    clientId: g.clientId,
    clientName: `${g.client.firstName} ${g.client.lastName}`.trim(),
    grantedAt: g.grantedAt.toISOString(),
    grantedByName: g.granter
      ? `${g.granter.firstName} ${g.granter.lastName}`.trim()
      : null,
    redeemedInvoiceId: g.redeemedInvoiceId,
    redeemedInvoiceNumber:
      g.redeemedInvoiceId != null
        ? formatInvoiceNumber(g.redeemedInvoiceId)
        : null,
    redeemedAt: g.redeemedAt?.toISOString() ?? null,
    expired: isExpired(g.offer.expiresOn),
  };
}

// ---- catalogue ----

export async function listOffers(
  includeArchived: boolean,
): Promise<OfferDTO[]> {
  const [offers, redeemed] = await Promise.all([
    prisma.offer.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      include: offerInclude,
      orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }],
    }),
    // Counted in one pass rather than as a second nested _count, which Prisma
    // cannot filter two ways on the same relation.
    prisma.offerGrant.groupBy({
      by: ["offerId"],
      where: { redeemedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const spent = new Map(redeemed.map((r) => [r.offerId, r._count._all]));
  return offers.map((o) => toOfferDTO(o, spent.get(o.offerId) ?? 0));
}

// The zero side of the discount is written explicitly, so the row always
// satisfies offers_one_discount_mode rather than relying on a column default.
function discountColumns(input: {
  discountMode: string;
  discountPct: number;
  discountAmount: number;
}) {
  return input.discountMode === "pct"
    ? { discountMode: "pct", discountPct: input.discountPct, discountAmount: 0 }
    : {
        discountMode: "amount",
        discountPct: 0,
        discountAmount: input.discountAmount,
      };
}

export async function createOffer(
  input: CreateOfferInput,
  createdBy: number,
): Promise<OfferDTO> {
  const offer = await prisma.offer.create({
    data: {
      name: input.name,
      ...discountColumns(input),
      notes: input.notes ?? null,
      expiresOn: input.expiresOn
        ? new Date(`${input.expiresOn}T00:00:00.000Z`)
        : null,
      createdBy,
    },
    include: offerInclude,
  });
  return toOfferDTO(offer, 0);
}

export async function updateOffer(
  offerId: number,
  input: UpdateOfferInput,
): Promise<OfferDTO> {
  const existing = await prisma.offer.findUnique({ where: { offerId } });
  if (!existing) throw new ApiError(404, "Offer not found");

  const offer = await prisma.offer.update({
    where: { offerId },
    data: {
      name: input.name,
      ...discountColumns(input),
      notes: input.notes ?? null,
      expiresOn: input.expiresOn
        ? new Date(`${input.expiresOn}T00:00:00.000Z`)
        : null,
      ...(input.archived === undefined
        ? {}
        : { archivedAt: input.archived ? new Date() : null }),
    },
    include: offerInclude,
  });
  const redeemed = await prisma.offerGrant.count({
    where: { offerId, redeemedAt: { not: null } },
  });
  return toOfferDTO(offer, redeemed);
}

// ---- granting ----

// Gives one offer to a set of clients.
//
// Clients who already hold it live are skipped rather than given a second copy:
// the partial unique index does that in the database, so two people granting
// from the same list at the same moment cannot stack two discounts on one
// client. What comes back is what actually happened, which is why clicking
// Grant twice reads as "nothing new" instead of silently doubling.
export async function grantOffer(
  offerId: number,
  clientIds: number[],
  grantedBy: number,
): Promise<OfferGrantResultDTO> {
  const offer = await prisma.offer.findUnique({ where: { offerId } });
  if (!offer) throw new ApiError(404, "Offer not found");
  if (offer.archivedAt != null) {
    throw new ApiError(400, "That offer has been retired");
  }
  if (isExpired(offer.expiresOn)) {
    throw new ApiError(400, "That offer has expired");
  }

  // Archived clients are dropped here rather than failing the whole batch: a
  // list of a hundred should not be refused because one row went stale while
  // it was on screen.
  const live = await prisma.client.findMany({
    where: { clientId: { in: clientIds }, deletedAt: null },
    select: { clientId: true },
  });
  if (live.length === 0) {
    throw new ApiError(400, "None of those clients are on file");
  }

  const result = await prisma.offerGrant.createMany({
    data: live.map((c) => ({ offerId, clientId: c.clientId, grantedBy })),
    skipDuplicates: true,
  });

  return {
    granted: result.count,
    alreadyHeld: live.length - result.count,
    offerName: offer.name,
  };
}

// Every grant a client holds, live ones first, with what was already spent
// underneath so the counter can see this is not the first time.
export async function listClientGrants(
  clientId: number,
): Promise<OfferGrantDTO[]> {
  const grants = await prisma.offerGrant.findMany({
    where: { clientId, revokedAt: null },
    include: grantInclude,
    orderBy: [{ redeemedAt: "asc" }, { grantedAt: "desc" }],
  });
  return grants.map(toGrantDTO);
}

// The one grant an invoice's banner offers to apply: held by this client,
// never spent, not revoked, not past its offer's expiry. Oldest first, so a
// client holding two is offered the one that has been waiting longest.
export async function findRedeemableGrant(
  clientId: number,
): Promise<OfferGrantDTO | null> {
  const grant = await prisma.offerGrant.findFirst({
    where: {
      clientId,
      redeemedAt: null,
      revokedAt: null,
      offer: {
        OR: [{ expiresOn: null }, { expiresOn: { gte: todayDateOnly() } }],
      },
    },
    include: grantInclude,
    orderBy: { grantedAt: "asc" },
  });
  return grant ? toGrantDTO(grant) : null;
}

export async function revokeGrant(grantId: number): Promise<void> {
  const grant = await prisma.offerGrant.findUnique({ where: { grantId } });
  if (!grant) throw new ApiError(404, "Offer not found on this client");
  if (grant.redeemedAt != null) {
    throw new ApiError(
      400,
      "That offer was already used on an invoice. Take it off the invoice instead.",
    );
  }
  await prisma.offerGrant.update({
    where: { grantId },
    data: { revokedAt: new Date() },
  });
}

// ---- redeeming ----

// What the offer becomes on the invoice: the same two columns a discount typed
// at the counter writes to, so the receipt, the PDF and every total downstream
// need to know nothing about offers at all.
function invoiceDiscountFor(offer: {
  discountMode: string;
  discountPct: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
}) {
  return offer.discountMode === "pct"
    ? { discountPct: offer.discountPct, discountAmount: new Prisma.Decimal(0) }
    : {
        discountPct: new Prisma.Decimal(0),
        discountAmount: offer.discountAmount,
      };
}

export interface RedeemResult {
  /** The discount this replaced, when the invoice already carried one. */
  replaced: string | null;
}

// Spends a grant against a draft invoice.
//
// Draft only: an issued invoice's totals are frozen, and a discount applied
// after the customer has paid is a credit note, not an offer. One transaction,
// so a grant can never be marked spent without the discount actually landing.
export async function redeemGrant(
  invoiceId: number,
  grantId: number,
): Promise<RedeemResult> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { invoiceId },
      select: {
        invoiceId: true,
        clientId: true,
        status: true,
        discountPct: true,
        discountAmount: true,
      },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status !== "Draft") {
      throw new ApiError(400, "Only a draft invoice can take an offer");
    }

    const grant = await tx.offerGrant.findUnique({
      where: { grantId },
      include: { offer: true },
    });
    if (!grant) throw new ApiError(404, "Offer not found");
    if (grant.clientId !== invoice.clientId) {
      throw new ApiError(400, "That offer belongs to a different client");
    }
    if (grant.redeemedAt != null) {
      throw new ApiError(400, "That offer has already been used");
    }
    if (grant.revokedAt != null) {
      throw new ApiError(400, "That offer was taken back");
    }
    if (isExpired(grant.offer.expiresOn)) {
      throw new ApiError(400, "That offer has expired");
    }

    // Said out loud rather than swallowed. The counter may have typed a
    // discount already, and an offer that quietly overwrote it would change
    // what the customer was told without anyone seeing.
    const hadPct = !invoice.discountPct.isZero();
    const hadAmount = !invoice.discountAmount.isZero();
    const replaced = hadPct
      ? `${invoice.discountPct.toFixed(2)}%`
      : hadAmount
        ? invoice.discountAmount.toFixed(2)
        : null;

    await tx.invoice.update({
      where: { invoiceId },
      data: invoiceDiscountFor(grant.offer),
    });
    await tx.offerGrant.update({
      where: { grantId },
      data: { redeemedInvoiceId: invoiceId, redeemedAt: new Date() },
    });
    await recomputeInvoiceTotals(tx, invoiceId);

    return { replaced };
  });
}

// Takes the offer back off a draft invoice: the discount goes to zero and the
// grant returns to the client unspent. This is what makes applying one safe to
// undo, and it is the same path a mistake on the counter takes.
export async function releaseGrantFromInvoice(
  invoiceId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { invoiceId },
      select: { status: true },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status !== "Draft") {
      throw new ApiError(
        400,
        "This invoice has been issued. Void it to undo the offer.",
      );
    }

    const grant = await tx.offerGrant.findFirst({
      where: { redeemedInvoiceId: invoiceId },
    });
    if (!grant) throw new ApiError(404, "No offer on this invoice");

    await tx.offerGrant.update({
      where: { grantId: grant.grantId },
      data: { redeemedInvoiceId: null, redeemedAt: null },
    });
    await tx.invoice.update({
      where: { invoiceId },
      data: { discountPct: 0, discountAmount: 0 },
    });
    await recomputeInvoiceTotals(tx, invoiceId);
  });
}

// The grant spent on this invoice, if any. Drawn on the invoice so the line
// reading "Discount" can say where it came from.
export async function findGrantOnInvoice(
  invoiceId: number,
): Promise<OfferGrantDTO | null> {
  const grant = await prisma.offerGrant.findFirst({
    where: { redeemedInvoiceId: invoiceId },
    include: grantInclude,
  });
  return grant ? toGrantDTO(grant) : null;
}
