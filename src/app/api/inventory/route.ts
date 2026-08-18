import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { isUniqueConstraintError, toInventoryItemDTO } from "@/lib/inventory";
import { writeAudit } from "@/lib/audit";
import { inventoryItemCreateSchema } from "@/schemas/inventory";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("inventory:read");

    const sp = new URL(request.url).searchParams;
    const q = sp.get("q")?.trim();
    const category = sp.get("category")?.trim();
    const lowStock = sp.get("lowStock") === "true";
    // "none" filters to items with no usual supplier assigned yet; a numeric id
    // filters to that supplier. Anything else is ignored rather than erroring.
    const supplier = sp.get("supplier")?.trim();
    const supplierId = Number(supplier);
    const supplierFilter =
      supplier === "none"
        ? { supplierId: null }
        : supplier && Number.isInteger(supplierId)
          ? { supplierId }
          : {};

    const items = await prisma.inventoryItem.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
                { barcode: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(category ? { category } : {}),
        ...supplierFilter,
      },
      include: {
        partner: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    // Low-stock compares two columns, so filter after mapping (the DTO already
    // computes the flag). Inventory lists are small enough that this is cheap.
    const dtos = items
      .map(toInventoryItemDTO)
      .filter((d) => (lowStock ? d.isLowStock : true));

    return NextResponse.json({ items: dtos });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("inventory:write");
    const data = await parseBody(request, inventoryItemCreateSchema);

    const openingStock = data.openingStock ?? 0;

    try {
      // Create the item and, when an opening stock is given, seed a Received
      // movement for it in the same transaction so stock and its audit trail
      // are created together and can never diverge.
      const item = await prisma.$transaction(async (tx) => {
        const created = await tx.inventoryItem.create({
          data: {
            name: data.name,
            category: data.category,
            barcode: data.barcode,
            unit: data.unit,
            reorderLevel: data.reorderLevel,
            salePrice: data.salePrice,
            lastCost: data.lastCost,
            partnerId: data.partnerId ?? null,
            partnerSharePct: data.partnerSharePct ?? null,
            supplierId: data.supplierId ?? null,
            expiryDate: data.expiryDate,
            notes: data.notes,
          },
        });

        if (openingStock > 0) {
          await tx.inventoryTransaction.create({
            data: {
              itemId: created.itemId,
              performedBy: session.user.userId,
              type: "Received",
              quantity: openingStock,
              unitCost: data.lastCost,
              referenceType: "opening",
              notes: "Opening stock",
            },
          });
          return tx.inventoryItem.update({
            where: { itemId: created.itemId },
            data: { currentStock: { increment: openingStock } },
          });
        }

        return created;
      });

      await writeAudit(session, {
        action: "create",
        entity: "inventory_item",
        entityId: item.itemId,
        changes: data,
      });
      return NextResponse.json(
        { item: toInventoryItemDTO(item) },
        { status: 201 },
      );
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ApiError(409, "That barcode is already in use.");
      }
      throw err;
    }
  });
}
