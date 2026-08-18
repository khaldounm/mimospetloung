import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import {
  cancelNotification,
  dispatchNotification,
  notificationInclude,
  toNotificationDTO,
} from "@/lib/notifications";
import { writeAudit } from "@/lib/audit";
import { notificationActionSchema } from "@/schemas/notification";

async function getNotificationId(params: Promise<{ notificationId: string }>) {
  const { notificationId } = await params;
  const id = Number(notificationId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  return handle(async () => {
    await requirePermission("notifications:read");
    const notificationId = await getNotificationId(params);

    const notification = await prisma.notification.findUnique({
      where: { notificationId },
      include: notificationInclude,
    });
    if (!notification) throw new ApiError(404, "Notification not found");

    return NextResponse.json({
      notification: toNotificationDTO(notification),
    });
  });
}

// Lifecycle actions: send / retry (both dispatch through the channel) or cancel.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("notifications:write");
    const notificationId = await getNotificationId(params);
    const { action } = await parseBody(request, notificationActionSchema);

    const notification =
      action === "cancel"
        ? await cancelNotification(notificationId)
        : await dispatchNotification(notificationId);

    await writeAudit(session, {
      action: action === "cancel" ? "cancel" : "send",
      entity: "notification",
      entityId: notificationId,
      changes: { action, status: notification.status },
    });

    return NextResponse.json({ notification });
  });
}
