import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  handle,
  parseBody,
  parseId,
  requirePermission,
} from "@/lib/api";
import { getSupplier, toSupplierDTO } from "@/lib/suppliers";
import { writeAudit } from "@/lib/audit";
import { supplierUpdateSchema } from "@/schemas/supplier";

async function getSupplierId(params: Promise<{ supplierId: string }>) {
  return parseId((await params).supplierId, "supplier id");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  return handle(async () => {
    await requirePermission("orders:read");
    const supplierId = await getSupplierId(params);

    const supplier = await getSupplier(supplierId);
    if (!supplier) throw new ApiError(404, "Supplier not found");

    return NextResponse.json({ supplier });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const supplierId = await getSupplierId(params);
    const data = await parseBody(request, supplierUpdateSchema);

    const existing = await prisma.supplier.findFirst({
      where: { supplierId, deletedAt: null },
      select: { supplierId: true },
    });
    if (!existing) throw new ApiError(404, "Supplier not found");

    const supplier = await prisma.supplier.update({
      where: { supplierId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.contactPerson !== undefined
          ? { contactPerson: data.contactPerson }
          : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await writeAudit(session, {
      action: "update",
      entity: "supplier",
      entityId: supplierId,
      changes: data,
    });
    return NextResponse.json({ supplier: toSupplierDTO(supplier) });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("orders:write");
    const supplierId = await getSupplierId(params);

    const existing = await prisma.supplier.findFirst({
      where: { supplierId, deletedAt: null },
      select: { supplierId: true },
    });
    if (!existing) throw new ApiError(404, "Supplier not found");

    // The FK is SET NULL, so removing a supplier would silently clear it off
    // every item that reorders from it. Refuse instead and point at the
    // deactivate path, which hides the supplier from pickers without losing the
    // link on items that still name it.
    const activeItems = await prisma.inventoryItem.count({
      where: { supplierId, deletedAt: null },
    });
    if (activeItems > 0) {
      throw new ApiError(
        409,
        `${activeItems} inventory item(s) still reorder from this supplier. Reassign them, or mark the supplier inactive instead of removing it.`,
      );
    }

    // Soft-delete: historical purchase orders keep naming who they went to.
    await prisma.supplier.update({
      where: { supplierId },
      data: { deletedAt: new Date(), isActive: false },
    });
    await writeAudit(session, {
      action: "delete",
      entity: "supplier",
      entityId: supplierId,
      changes: { softDelete: true },
    });
    return NextResponse.json({ ok: true });
  });
}
