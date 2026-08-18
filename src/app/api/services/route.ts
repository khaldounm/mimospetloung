import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, parseBody, requirePermission } from "@/lib/api";
import { toServiceDTO } from "@/lib/invoices";
import { writeAudit } from "@/lib/audit";
import { serviceCreateSchema } from "@/schemas/service";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("invoices:read");

    const sp = new URL(request.url).searchParams;
    const q = sp.get("q")?.trim();
    const activeOnly = sp.get("activeOnly") === "true";

    const services = await prisma.service.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ services: services.map(toServiceDTO) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const data = await parseBody(request, serviceCreateSchema);

    const service = await prisma.service.create({
      data: {
        name: data.name,
        category: data.category,
        price: data.price,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        description: data.description,
      },
    });

    await writeAudit(session, {
      action: "create",
      entity: "service",
      entityId: service.serviceId,
      changes: data,
    });

    return NextResponse.json(
      { service: toServiceDTO(service) },
      { status: 201 },
    );
  });
}
