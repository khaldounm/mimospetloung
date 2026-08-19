import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import {
  isUniqueConstraintError,
  listInventory,
  toInventoryItemDTO,
} from "@/lib/inventory";
import { writeAudit } from "@/lib/audit";
import { inventoryItemCreateSchema } from "@/schemas/inventory";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("inventory:read");

    const sp = new URL(request.url).searchParams;
    const pageRaw = sp.get("page")?.trim();

    // Paged and filtered in SQL. The category comes from the route on the page
    // itself, and is echoed here so a refetch after a search stays inside it.
    const page = await listInventory({
      category: sp.get("category")?.trim() || undefined,
      q: sp.get("q")?.trim() || undefined,
      lowStock: sp.get("lowStock") === "true",
      supplier: sp.get("supplier")?.trim() || undefined,
      page: pageRaw ? Number(pageRaw) : 1,
    });

    return NextResponse.json(page);
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
