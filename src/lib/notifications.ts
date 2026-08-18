import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { CLINIC } from "@/constants/clinic";
import { normalizePhone } from "@/utils/phone";
import {
  BOOKING_REMINDER_LEAD_DAYS,
  BOOKING_REMINDER_TRIGGER,
  MISSED_BOOKING_STATUSES,
  REMINDER_BOOKING_STATUSES,
} from "@/constants/notification";
import type {
  MissedBookingDTO,
  NotificationDTO,
  NotificationTemplateDTO,
  UpcomingBookingDTO,
} from "@/types/entities";
import type {
  BookingStatus,
  NotificationChannel,
  NotificationStatus,
} from "@/types/enums";

// ---- Includes + row types ----

export const notificationInclude = {
  client: { select: { firstName: true, lastName: true } },
  patient: { select: { name: true } },
  template: { select: { name: true } },
} as const;

type NotificationRow = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

type TemplateRow = Prisma.NotificationTemplateGetPayload<true>;

// ---- DTO mappers ----

export function toNotificationDTO(n: NotificationRow): NotificationDTO {
  return {
    notificationId: n.notificationId,
    clientId: n.clientId,
    clientName: `${n.client.firstName} ${n.client.lastName}`,
    patientId: n.patientId,
    patientName: n.patient?.name ?? null,
    bookingId: n.bookingId,
    templateId: n.templateId,
    templateName: n.template?.name ?? null,
    channel: n.channel as NotificationChannel | null,
    recipient: n.recipient,
    body: n.body,
    status: n.status as NotificationStatus,
    retryCount: n.retryCount,
    scheduledAt: n.scheduledAt ? n.scheduledAt.toISOString() : null,
    sentAt: n.sentAt ? n.sentAt.toISOString() : null,
    errorMessage: n.errorMessage,
    createdAt: n.createdAt.toISOString(),
  };
}

export function toTemplateDTO(t: TemplateRow): NotificationTemplateDTO {
  return {
    templateId: t.templateId,
    name: t.name,
    channel: t.channel as NotificationChannel | null,
    triggerEvent: t.triggerEvent,
    body: t.body,
    isActive: t.isActive,
  };
}

// ---- Placeholder rendering ----

export interface RenderContext {
  clientFirstName: string;
  clientLastName: string;
  patientName?: string | null;
  bookingStartsAt?: Date | null;
  dueDate?: string | null;
}

// "YYYY-MM-DD" -> "DD/MM/YYYY", empty string for null/undefined.
function formatDueDate(date?: string | null): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

// Substitute {{tokens}} in a template body with values from the linked entities.
// Unknown tokens are left untouched so authors notice typos.
export function renderBody(template: string, ctx: RenderContext): string {
  const at = ctx.bookingStartsAt ?? null;
  const map: Record<string, string> = {
    "{{client_name}}": `${ctx.clientFirstName} ${ctx.clientLastName}`.trim(),
    "{{client_first_name}}": ctx.clientFirstName,
    "{{patient_name}}": ctx.patientName ?? "",
    "{{booking_date}}": at
      ? at.toLocaleDateString("en-US", {
          timeZone: CLINIC.timezone,
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "",
    "{{booking_time}}": at
      ? at.toLocaleTimeString("en-US", {
          timeZone: CLINIC.timezone,
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
    "{{clinic_name}}": CLINIC.name,
    "{{due_date}}": formatDueDate(ctx.dueDate),
    "{{consultation_due_date}}": formatDueDate(ctx.dueDate),
    "{{vaccination_due_date}}": formatDueDate(ctx.dueDate),
    "{{grooming_due_date}}": formatDueDate(ctx.dueDate),
    "{{treatment_due_date}}": formatDueDate(ctx.dueDate),
  };
  return template.replace(/\{\{[a-z_]+\}\}/g, (token) =>
    token in map ? map[token] : token,
  );
}

// Resolve and freeze the recipient address for a channel from the client record.
export function resolveRecipient(
  channel: NotificationChannel,
  client: { phone: string | null; email: string | null },
): string {
  if (channel === "Email") {
    if (!client.email) {
      throw new ApiError(400, "Client has no email address on file");
    }
    return client.email;
  }
  // WhatsApp + SMS are addressed by phone number.
  if (!client.phone) {
    throw new ApiError(400, "Client has no phone number on file");
  }
  const normalized = normalizePhone(client.phone);
  if (!normalized) {
    throw new ApiError(
      400,
      `Client phone number "${client.phone}" is not valid`,
    );
  }
  return normalized;
}

// ---- WhatsApp Cloud API ----

// Default WaSenderApi endpoint. Override with WASENDER_API_URL if the provider
// changes the path or you proxy it through your own gateway.
const WASENDER_DEFAULT_URL = "https://www.wasenderapi.com/api/send-message";

// Sends a free-form text message via WaSenderApi (wasenderapi.com) and returns
// the provider message id. Throws a descriptive Error when the API key is
// missing or the provider rejects the request, so dispatchNotification records
// the notification as Failed.
async function sendViaWhatsApp(
  recipient: string,
  body: string,
): Promise<string> {
  const apiUrl = process.env.WASENDER_API_URL || WASENDER_DEFAULT_URL;
  const apiKey = process.env.WASENDER_API_KEY;
  if (!apiKey) {
    throw new Error("WhatsApp API is not configured. Set WASENDER_API_KEY.");
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: recipient,
      text: body,
    }),
  });

  const json = (await res.json().catch(() => null)) as {
    data?: { msgId?: string | number; id?: string | number };
    message?: string;
    error?: string;
  } | null;

  if (!res.ok) {
    throw new Error(
      json?.error ?? json?.message ?? `WhatsApp API error (${res.status})`,
    );
  }

  const id = json?.data?.msgId ?? json?.data?.id;
  return id != null ? String(id) : "";
}

// Sends a document (e.g. an invoice PDF) via WaSenderApi. The provider fetches
// the file from `documentUrl`, so it must be a publicly reachable URL. Returns
// the provider message id; throws a descriptive Error on failure.
export async function sendDocumentViaWhatsApp(
  recipient: string,
  documentUrl: string,
  fileName: string,
  caption?: string,
): Promise<string> {
  const apiUrl = process.env.WASENDER_API_URL || WASENDER_DEFAULT_URL;
  const apiKey = process.env.WASENDER_API_KEY;
  if (!apiKey) {
    throw new Error("WhatsApp API is not configured. Set WASENDER_API_KEY.");
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: recipient,
      documentUrl,
      fileName,
      ...(caption ? { text: caption } : {}),
    }),
  });

  const json = (await res.json().catch(() => null)) as {
    data?: { msgId?: string | number; id?: string | number };
    message?: string;
    error?: string;
  } | null;

  if (!res.ok) {
    throw new Error(
      json?.error ?? json?.message ?? `WhatsApp API error (${res.status})`,
    );
  }

  const id = json?.data?.msgId ?? json?.data?.id;
  return id != null ? String(id) : "";
}

// ---- Lifecycle ----

// Attempts to deliver a notification through its channel and records the outcome
// on the row (Sent + sent_at, or Failed + error + retry_count++). Used by both
// the manual "send now" action and the cron worker. Send failures are captured
// on the row rather than thrown, so callers always get the updated state.
export async function dispatchNotification(
  notificationId: number,
): Promise<NotificationDTO> {
  const n = await prisma.notification.findUnique({
    where: { notificationId },
    include: notificationInclude,
  });
  if (!n) throw new ApiError(404, "Notification not found");
  if (n.status === "Sent" || n.status === "Delivered") {
    throw new ApiError(409, "Notification has already been sent");
  }

  try {
    if (n.channel === "WhatsApp") {
      await sendViaWhatsApp(n.recipient, n.body);
    } else {
      throw new Error(
        `${n.channel ?? "This channel"} sending is not implemented yet`,
      );
    }
    const updated = await prisma.notification.update({
      where: { notificationId },
      data: { status: "Sent", sentAt: new Date(), errorMessage: null },
      include: notificationInclude,
    });
    return toNotificationDTO(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    const updated = await prisma.notification.update({
      where: { notificationId },
      data: {
        status: "Failed",
        retryCount: { increment: 1 },
        errorMessage: message,
      },
      include: notificationInclude,
    });
    return toNotificationDTO(updated);
  }
}

// Cancels a still-pending notification. The schema's status CHECK has no
// 'Cancelled' value, so we record it as Failed with a clear reason rather than
// deleting the row, preserving the audit trail.
export async function cancelNotification(
  notificationId: number,
): Promise<NotificationDTO> {
  const n = await prisma.notification.findUnique({
    where: { notificationId },
    include: notificationInclude,
  });
  if (!n) throw new ApiError(404, "Notification not found");
  if (n.status !== "Pending") {
    throw new ApiError(409, "Only pending notifications can be cancelled");
  }
  const updated = await prisma.notification.update({
    where: { notificationId },
    data: { status: "Failed", errorMessage: "Cancelled" },
    include: notificationInclude,
  });
  return toNotificationDTO(updated);
}

// Cron worker: dispatch all due pending notifications (no schedule, or scheduled
// at/<= now), oldest first. Backed by idx_notif_worker (status, scheduled_at).
export async function processPendingNotifications(
  limit = 50,
): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date();
  const due = await prisma.notification.findMany({
    where: {
      status: "Pending",
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { notificationId: true },
  });

  let sent = 0;
  let failed = 0;
  for (const d of due) {
    const result = await dispatchNotification(d.notificationId);
    if (result.status === "Sent") sent += 1;
    else failed += 1;
  }
  return { processed: due.length, sent, failed };
}

// ---- Compose ----

export interface ComposeInput {
  clientId: number;
  patientId?: number;
  bookingId?: number;
  templateId?: number;
  channel: NotificationChannel;
  body?: string;
  scheduledAt?: Date;
  dueDate?: string;
}

// Validates the links, renders + freezes the body, resolves + freezes the
// recipient, and creates the notification in Pending status.
export async function composeNotification(
  input: ComposeInput,
): Promise<NotificationDTO> {
  const client = await prisma.client.findFirst({
    where: { clientId: input.clientId, deletedAt: null },
  });
  if (!client) throw new ApiError(404, "Client not found");

  let patient: { name: string } | null = null;
  if (input.patientId !== undefined) {
    const p = await prisma.patient.findFirst({
      where: { patientId: input.patientId, deletedAt: null },
    });
    if (!p) throw new ApiError(404, "Patient not found");
    if (p.clientId !== client.clientId) {
      throw new ApiError(400, "Patient does not belong to this client");
    }
    patient = { name: p.name };
  }

  let bookingStartsAt: Date | null = null;
  if (input.bookingId !== undefined) {
    const b = await prisma.booking.findUnique({
      where: { bookingId: input.bookingId },
    });
    if (!b) throw new ApiError(404, "Booking not found");
    if (b.clientId !== client.clientId) {
      throw new ApiError(400, "Booking does not belong to this client");
    }
    bookingStartsAt = b.startsAt;
  }

  let rawBody = input.body?.trim() ?? "";
  if (input.templateId !== undefined) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { templateId: input.templateId },
    });
    if (!template) throw new ApiError(404, "Template not found");
    // A custom body overrides the template; otherwise use the template body.
    if (!rawBody) rawBody = template.body;
  }
  if (!rawBody) throw new ApiError(400, "Provide a template or a message body");

  const body = renderBody(rawBody, {
    clientFirstName: client.firstName,
    clientLastName: client.lastName,
    patientName: patient?.name,
    bookingStartsAt,
    dueDate: input.dueDate,
  });

  const recipient = resolveRecipient(input.channel, client);

  const created = await prisma.notification.create({
    data: {
      clientId: client.clientId,
      patientId: input.patientId ?? null,
      bookingId: input.bookingId ?? null,
      templateId: input.templateId ?? null,
      channel: input.channel,
      recipient,
      body,
      status: "Pending",
      scheduledAt: input.scheduledAt ?? null,
    },
    include: notificationInclude,
  });
  return toNotificationDTO(created);
}

// ---- Appointment reminders ----

// Returns the start (now) and end of the reminder window.
function reminderWindow(): { from: Date; to: Date } {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + BOOKING_REMINDER_LEAD_DAYS);
  return { from, to };
}

// The single active template used for appointment reminders, or null if the
// clinic hasn't set one up yet. If several are active we take the lowest id for
// determinism.
export async function getReminderTemplate(): Promise<TemplateRow | null> {
  return prisma.notificationTemplate.findFirst({
    where: { isActive: true, triggerEvent: BOOKING_REMINDER_TRIGGER },
    orderBy: { templateId: "asc" },
  });
}

// Lists eligible bookings inside the reminder window together with the status of
// their most recent reminder (a notification linked to the booking from the
// reminder template). Used by the Upcoming tab.
export async function listUpcomingBookings(): Promise<UpcomingBookingDTO[]> {
  const { from, to } = reminderWindow();
  const template = await getReminderTemplate();

  const bookings = await prisma.booking.findMany({
    where: {
      startsAt: { gte: from, lte: to },
      status: { in: REMINDER_BOOKING_STATUSES },
      client: { deletedAt: null },
    },
    orderBy: { startsAt: "asc" },
    include: {
      client: { select: { firstName: true, lastName: true } },
      patient: { select: { name: true } },
      notifications: template
        ? {
            where: { templateId: template.templateId },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { notificationId: true, status: true },
          }
        : false,
    },
  });

  return bookings.map((b) => {
    const reminder = template ? b.notifications[0] : undefined;
    return {
      bookingId: b.bookingId,
      clientId: b.clientId,
      clientName: `${b.client.firstName} ${b.client.lastName}`,
      patientName: b.patient.name,
      startsAt: b.startsAt.toISOString(),
      bookingStatus: b.status as BookingStatus,
      reminderStatus: reminder ? (reminder.status as NotificationStatus) : null,
      reminderNotificationId: reminder?.notificationId ?? null,
    };
  });
}

// Lists past bookings that were never completed (still Scheduled / Confirmed,
// or a recorded No Show), most recent first. Used by the Missed tab so staff
// can follow up. Bookings whose client has been archived are excluded.
export async function listMissedBookings(): Promise<MissedBookingDTO[]> {
  const now = new Date();

  const bookings = await prisma.booking.findMany({
    where: {
      endsAt: { lt: now },
      status: { in: MISSED_BOOKING_STATUSES },
      client: { deletedAt: null },
    },
    orderBy: { startsAt: "desc" },
    take: 200,
    include: {
      client: { select: { firstName: true, lastName: true } },
      patient: { select: { name: true } },
    },
  });

  return bookings.map((b) => ({
    bookingId: b.bookingId,
    clientId: b.clientId,
    clientName: `${b.client.firstName} ${b.client.lastName}`,
    patientId: b.patientId,
    patientName: b.patient.name,
    startsAt: b.startsAt.toISOString(),
    bookingStatus: b.status as BookingStatus,
  }));
}

// Creates (if needed) and sends a reminder for one booking. Idempotent for
// already-handled bookings: if a non-failed reminder exists we return it instead
// of creating a duplicate. Requires an active reminder template.
export async function sendBookingReminder(
  bookingId: number,
): Promise<NotificationDTO> {
  const template = await getReminderTemplate();
  if (!template) {
    throw new ApiError(
      400,
      `No active reminder template. Create a template with trigger event "${BOOKING_REMINDER_TRIGGER}".`,
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingId },
    include: {
      client: true,
      patient: { select: { name: true } },
    },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.client.deletedAt) {
    throw new ApiError(400, "Booking client has been archived");
  }
  if (!REMINDER_BOOKING_STATUSES.includes(booking.status as BookingStatus)) {
    throw new ApiError(
      400,
      `Bookings with status "${booking.status}" do not get reminders`,
    );
  }

  // Idempotency: reuse an existing reminder unless it failed.
  const existing = await prisma.notification.findFirst({
    where: {
      bookingId,
      templateId: template.templateId,
      status: { not: "Failed" },
    },
    orderBy: { createdAt: "desc" },
    include: notificationInclude,
  });
  if (existing) return toNotificationDTO(existing);

  const channel = (template.channel ?? "WhatsApp") as NotificationChannel;
  const body = renderBody(template.body, {
    clientFirstName: booking.client.firstName,
    clientLastName: booking.client.lastName,
    patientName: booking.patient.name,
    bookingStartsAt: booking.startsAt,
  });
  const recipient = resolveRecipient(channel, booking.client);

  const created = await prisma.notification.create({
    data: {
      clientId: booking.clientId,
      patientId: booking.patientId,
      bookingId: booking.bookingId,
      templateId: template.templateId,
      channel,
      recipient,
      body,
      status: "Pending",
    },
  });

  // Send immediately: with manual-trigger-only there is no worker to pick it up.
  return dispatchNotification(created.notificationId);
}

// Sends reminders for every eligible booking in the window that does not yet
// have a (non-failed) reminder. Bookings missing contact details are skipped and
// counted rather than aborting the whole run.
export async function generateBookingReminders(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const upcoming = await listUpcomingBookings();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const b of upcoming) {
    if (b.reminderStatus && b.reminderStatus !== "Failed") continue;
    try {
      const result = await sendBookingReminder(b.bookingId);
      if (result.status === "Sent" || result.status === "Delivered") sent += 1;
      else failed += 1;
    } catch {
      // Missing contact / ineligible: skip and keep going.
      skipped += 1;
    }
  }
  return { sent, failed, skipped };
}
