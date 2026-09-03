import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, parseBody, requirePermission } from "@/lib/api";
import { canSeePayables } from "@/lib/permissions";
import {
  getActiveSuppliers,
  getSuppliersWithStats,
  supplierInclude,
  toSupplierDTO,
  writeSupplierContacts,
} from "@/lib/suppliers";
import { writeAudit } from "@/lib/audit";
import { supplierCreateSchema } from "@/schemas/supplier";

export async function GET(request: Request) {
  return handle(async () => {
    const session = await requirePermission("orders:read");

    // ?active=1 returns the lightweight active list for the inventory picker;
    // otherwise the full list with item counts.
    const active = new URL(request.url).searchParams.get("active") === "1";
    const suppliers = active
      ? await getActiveSuppliers()
      : await getSuppliersWithStats(canSeePayables(session.user));

    return NextResponse.json({ suppliers });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const data = await parseBody(request, supplierCreateSchema);

    // One transaction so a supplier is never created with half its contacts:
    // the reachability CHECK or the primary index can still reject a row.
    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          name: data.name,
          notes: data.notes,
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
      });
      if (data.contacts?.length) {
        await writeSupplierContacts(tx, created.supplierId, data.contacts);
      }
      return tx.supplier.findUniqueOrThrow({
        where: { supplierId: created.supplierId },
        include: supplierInclude,
      });
    });
    await writeAudit(session, {
      action: "create",
      entity: "supplier",
      entityId: supplier.supplierId,
      changes: data,
    });
    // A brand new supplier has no items, orders or payments, so the bare DTO is
    // already the whole truth. The client refreshes for the stats anyway.
    return NextResponse.json(
      { supplier: toSupplierDTO(supplier) },
      { status: 201 },
    );
  });
}
