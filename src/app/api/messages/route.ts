import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, requirePermission } from "@/lib/api";
import { toContactMessageDTO } from "@/lib/messages";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("notifications:read");

    const status = new URL(request.url).searchParams.get("status")?.trim();

    const messages = await prisma.contactMessage.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ messages: messages.map(toContactMessageDTO) });
  });
}
