import { NextResponse } from "next/server";
import { handle, parseBody, requirePermission } from "@/lib/api";
import {
  generateBookingReminders,
  listUpcomingBookings,
  sendBookingReminder,
} from "@/lib/notifications";
import { writeAudit } from "@/lib/audit";
import { reminderActionSchema } from "@/schemas/notification";

// Upcoming bookings inside the reminder window, with their reminder status.
export async function GET() {
  return handle(async () => {
    await requirePermission("notifications:read");
    const bookings = await listUpcomingBookings();
    return NextResponse.json({ bookings });
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
