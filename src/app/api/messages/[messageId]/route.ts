import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { toContactMessageDTO } from "@/lib/messages";
import { contactMessageUpdateSchema } from "@/schemas/contact-message";

async function getMessageId(params: Promise<{ messageId: string }>) {
  const { messageId } = await params;
  const id = Number(messageId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

// Triage a website message: change its status (New / Read / Archived). The
// message content is immutable, so status is the only mutable field.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("notifications:write");
    const messageId = await getMessageId(params);
    const { status } = await parseBody(request, contactMessageUpdateSchema);

    const existing = await prisma.contactMessage.findUnique({
      where: { messageId },
    });
    if (!existing) throw new ApiError(404, "Message not found");

    const message = await prisma.contactMessage.update({
      where: { messageId },
      data: { status },
    });

    await writeAudit(session, {
      action: "update",
      entity: "contact_message",
      entityId: messageId,
      changes: { status: { from: existing.status, to: status } },
    });

    return NextResponse.json({ message: toContactMessageDTO(message) });
  });
}
