import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, parseBody, requirePermission } from "@/lib/api";
import { toTemplateDTO } from "@/lib/notifications";
import { templateCreateSchema } from "@/schemas/notification";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("notifications:read");

    const sp = new URL(request.url).searchParams;
    const q = sp.get("q")?.trim();
    const activeOnly = sp.get("activeOnly") === "true";

    const templates = await prisma.notificationTemplate.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ templates: templates.map(toTemplateDTO) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await requirePermission("notifications:write");
    const data = await parseBody(request, templateCreateSchema);

    const template = await prisma.notificationTemplate.create({
      data: {
        name: data.name,
        channel: data.channel,
        triggerEvent: data.triggerEvent,
        body: data.body,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    return NextResponse.json(
      { template: toTemplateDTO(template) },
      { status: 201 },
    );
  });
}
