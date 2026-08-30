import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canSeeCost,
  canSeePartnerDeal,
  hasPermission,
} from "@/lib/permissions";
import { toServiceDTO } from "@/lib/invoices";
import { costComponentInclude } from "@/lib/services";
import ServicesTable from "@/components/invoices/ServicesTable";

export default async function ServicesPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "invoices:write");
  const canSeeDeal = canSeePartnerDeal(session?.user);
  // Setting a deal is a partners:write term; seeing one is partners:read. Both
  // are Admin today, but they are asked separately so a future read-only
  // partner role reads the column without being able to change it.
  const canEditDeal = hasPermission(session?.user, "partners:write");
  // Cost rides on orders:*, the same split that keeps purchase prices away from
  // clinical staff. See canSeeCost.
  const visible = { deal: canSeeDeal, cost: canSeeCost(session?.user) };
  const canEditCost = hasPermission(session?.user, "orders:write");

  const services = await prisma.service.findMany({
    orderBy: { name: "asc" },
    include: {
      ...(visible.deal ? { partner: { select: { name: true } } } : {}),
      ...(visible.cost ? { costComponents: costComponentInclude } : {}),
    },
  });

  return (
    <ServicesTable
      initialServices={services.map((s) => toServiceDTO(s, visible))}
      canWrite={canWrite}
      canSeeDeal={canSeeDeal}
      canEditDeal={canEditDeal}
      canSeeCost={visible.cost}
      canEditCost={canEditCost}
    />
  );
}
