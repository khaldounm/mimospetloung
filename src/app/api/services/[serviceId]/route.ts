import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { toServiceDTO } from "@/lib/invoices";
import { writeAudit } from "@/lib/audit";
import { serviceUpdateSchema } from "@/schemas/service";

async function getServiceId(params: Promise<{ serviceId: string }>) {
  const { serviceId } = await params;
  const id = Number(serviceId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  return handle(async () => {
    await requirePermission("invoices:read");
    const serviceId = await getServiceId(params);

    const service = await prisma.service.findUnique({ where: { serviceId } });
    if (!service) throw new ApiError(404, "Service not found");

    return NextResponse.json({ service: toServiceDTO(service) });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const serviceId = await getServiceId(params);
    const data = await parseBody(request, serviceUpdateSchema);

    const existing = await prisma.service.findUnique({ where: { serviceId } });
    if (!existing) throw new ApiError(404, "Service not found");

    const service = await prisma.service.update({
      where: { serviceId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
      },
    });

    await writeAudit(session, {
      action: "update",
      entity: "service",
      entityId: serviceId,
      changes: data,
    });

    return NextResponse.json({ service: toServiceDTO(service) });
  });
}

// Services are referenced by historical line items, so we deactivate rather than
// hard-delete. Past invoices keep their frozen labels; the service just stops
// appearing in the picker.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const serviceId = await getServiceId(params);

    const existing = await prisma.service.findUnique({ where: { serviceId } });
    if (!existing) throw new ApiError(404, "Service not found");

    await prisma.service.update({
      where: { serviceId },
      data: { isActive: false },
    });

    await writeAudit(session, {
      action: "delete",
      entity: "service",
      entityId: serviceId,
      changes: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  });
}
