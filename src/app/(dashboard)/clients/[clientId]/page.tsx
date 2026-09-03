import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import {
  OFFER_GRANT_PERMISSION,
  OFFER_MANAGE_PERMISSION,
} from "@/constants/offers";
import { getFxRate } from "@/lib/settings";
import { toDateOnly } from "@/utils/format";
import type { ClientDTO, PatientDTO } from "@/types/entities";
import ClientDetail from "@/components/clients/ClientDetail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await auth();
  const canWrite = hasPermission(session?.user, "patients:write");
  // Taking money is its own permission, the same one the invoice payment
  // button is gated on.
  const canPay = hasPermission(session?.user, "payments:write");
  // An offer is a discount decided in advance, so giving one follows the same
  // permission as discounting an invoice. Creating the deal itself is admin.
  const canGrantOffer = hasPermission(session?.user, OFFER_GRANT_PERMISSION);
  const canManageOffers = hasPermission(session?.user, OFFER_MANAGE_PERMISSION);
  const fxRate = await getFxRate();

  const client = await prisma.client.findFirst({
    where: { clientId: id, deletedAt: null },
    include: {
      patients: { where: { deletedAt: null }, orderBy: { name: "asc" } },
      // At most one: the import writes a single row per client, dated the day
      // the new system took over.
      openingBalances: { orderBy: { asOfDate: "asc" }, take: 1 },
    },
  });
  if (!client) notFound();

  const opening = client.openingBalances[0] ?? null;

  const dto: ClientDTO = {
    clientId: client.clientId,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
    needsReview: client.needsReview,
    reviewNote: client.reviewNote,
    accountBalance: client.accountBalance.toFixed(2),
    openingBalance: opening
      ? {
          amount: opening.amount.toFixed(2),
          asOfDate: toDateOnly(opening.asOfDate) ?? "",
          source: opening.source,
        }
      : null,
  };

  const patients: PatientDTO[] = client.patients.map((p) => ({
    patientId: p.patientId,
    clientId: p.clientId,
    name: p.name,
    species: p.species,
    breed: p.breed,
    dateOfBirth: toDateOnly(p.dateOfBirth),
    sex: p.sex,
    isNeutered: p.isNeutered,
    microchipId: p.microchipId,
    needsReview: p.needsReview,
    reviewNote: p.reviewNote,
    notes: p.notes,
  }));

  return (
    <ClientDetail
      client={dto}
      patients={patients}
      canWrite={canWrite}
      canPay={canPay}
      canGrantOffer={canGrantOffer}
      canManageOffers={canManageOffers}
      fxRate={fxRate}
    />
  );
}
