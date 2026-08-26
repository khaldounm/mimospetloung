import { NextResponse } from "next/server";
import { handle, parseBody, requirePermission } from "@/lib/api";
import {
  generateBookingReminders,
  listUpcomingBookings,
  sendBookingReminder,
} from "@/lib/notifications";
import { writeAudit } from "@/lib/audit";
import { reminderActionSchema } from "@/schemas/notification";

// One page of upcoming bookings inside the reminder window, with their
// reminder status. Filtered and paged in SQL: the tab is a worklist, and a busy
// week of bookings is not something to hand to the browser in one piece.
export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("notifications:read");

    const sp = new URL(request.url).searchParams;
    const pageRaw = sp.get("page")?.trim();
    const page = await listUpcomingBookings({
      q: sp.get("q")?.trim() || undefined,
      pendingOnly: sp.get("pending") === "1",
      page: pageRaw ? Number(pageRaw) : 1,
    });

    return NextResponse.json(page);
  });
}

// Manually trigger reminders: one booking ({ bookingId }) or all eligible
// upcoming bookings ({ all: true }).
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("notifications:write");
    const data = await parseBody(request, reminderActionSchema);

    if (data.bookingId !== undefined) {
      const notification = await sendBookingReminder(data.bookingId);

      await writeAudit(session, {
        action: "send",
        entity: "notification",
        entityId: notification.notificationId,
        changes: { bookingId: data.bookingId, status: notification.status },
      });

      return NextResponse.json({ notification });
    }

    const result = await generateBookingReminders();
    return NextResponse.json({ result });
  });
}
