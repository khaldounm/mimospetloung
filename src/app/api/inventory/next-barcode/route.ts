import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, requirePermission } from "@/lib/api";
import { randomInternalEan13 } from "@/utils/barcode";

// Mints a fresh internal EAN-13 that is not already used by any item. The 10
// random digits give a 10^10 space, so a collision is near-impossible, but we
// verify against the DB and retry a few times to be certain.
export async function GET() {
  return handle(async () => {
    await requirePermission("inventory:write");

    for (let attempt = 0; attempt < 5; attempt++) {
      const barcode = randomInternalEan13();
      const existing = await prisma.inventoryItem.findUnique({
        where: { barcode },
        select: { itemId: true },
      });
      if (!existing) return NextResponse.json({ barcode });
    }

    throw new ApiError(500, "Could not generate a unique barcode, try again.");
  });
}
