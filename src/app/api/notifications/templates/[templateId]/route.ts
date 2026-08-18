import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { toTemplateDTO } from "@/lib/notifications";
import { templateUpdateSchema } from "@/schemas/notification";

async function getTemplateId(params: Promise<{ templateId: string }>) {
  const { templateId } = await params;
  const id = Number(templateId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  return handle(async () => {
    await requirePermission("notifications:read");
    const templateId = await getTemplateId(params);

    const template = await prisma.notificationTemplate.findUnique({
      where: { templateId },
    });
    if (!template) throw new ApiError(404, "Template not found");

    return NextResponse.json({ template: toTemplateDTO(template) });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  return handle(async () => {
    await requirePermission("notifications:write");
    const templateId = await getTemplateId(params);
    const data = await parseBody(request, templateUpdateSchema);

    const existing = await prisma.notificationTemplate.findUnique({
      where: { templateId },
    });
    if (!existing) throw new ApiError(404, "Template not found");

    const template = await prisma.notificationTemplate.update({
      where: { templateId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.channel !== undefined ? { channel: data.channel } : {}),
        ...(data.triggerEvent !== undefined
          ? { triggerEvent: data.triggerEvent }
          : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    return NextResponse.json({ template: toTemplateDTO(template) });
  });
}

// Templates may be referenced by historical notifications (ON DELETE SET NULL),
// so we deactivate rather than hard-delete. Past notifications keep their frozen
// body; the template just stops appearing in the picker.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  return handle(async () => {
    await requirePermission("notifications:write");
    const templateId = await getTemplateId(params);

    const existing = await prisma.notificationTemplate.findUnique({
      where: { templateId },
    });
    if (!existing) throw new ApiError(404, "Template not found");

    await prisma.notificationTemplate.update({
      where: { templateId },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  });
}
