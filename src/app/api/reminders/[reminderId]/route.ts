import { NextResponse } from "next/server";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { setReminderStatus } from "@/lib/reminders";
import { writeAudit } from "@/lib/audit";
import { reminderUpdateSchema } from "@/schemas/notification";

async function getReminderId(params: Promise<{ reminderId: string }>) {
  const { reminderId } = await params;
  const id = Number(reminderId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

// Apply a lifecycle action to a recall reminder: dismiss / done (terminal) or
// snooze (stays open, hidden until the given date).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reminderId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("notifications:write");
    const reminderId = await getReminderId(params);
    const data = await parseBody(request, reminderUpdateSchema);

    const reminder = await setReminderStatus(reminderId, data);

    await writeAudit(session, {
      // The specific lifecycle action is captured in `changes.action`.
      action: data.action === "dismiss" ? "cancel" : "update",
      entity: "reminder",
      entityId: reminderId,
      changes: data,
    });

    return NextResponse.json({ reminder });
  });
}
