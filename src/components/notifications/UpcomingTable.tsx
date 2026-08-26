"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { apiRequest } from "@/utils/api-client";
import { formatDateTime } from "@/utils/format";
import { hasSendAtNote, parseSendAtNote } from "@/utils/booking-notes";
import { NOTIFICATION_STATUS_COLOR } from "@/constants/notification";
import type { NotificationDTO, UpcomingBookingDTO } from "@/types/entities";

interface Props {
  initialUpcoming: UpcomingBookingDTO[];
  canWrite: boolean;
}

// A reminder that has already gone out. The Send button is closed off for
// these, and a send-time note on one of them has been overtaken by events.
function alreadySent(b: UpcomingBookingDTO): boolean {
  return b.reminderStatus === "Sent" || b.reminderStatus === "Delivered";
}

export default function UpcomingTable({ initialUpcoming, canWrite }: Props) {
  const [bookings, setBookings] = useState(initialUpcoming);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Bookings still waiting on a reminder whose note names a time to send it.
  const timed = bookings.filter(
    (b) => !alreadySent(b) && hasSendAtNote(b.notes),
  );

  async function refresh() {
    const data = await apiRequest<{ bookings: UpcomingBookingDTO[] }>(
      "/api/notifications/reminders",
    );
    setBookings(data.bookings);
  }

  async function sendOne(bookingId: number) {
    setError(null);
    setInfo(null);
    setBusyId(bookingId);
    try {
      const data = await apiRequest<{ notification: NotificationDTO }>(
        "/api/notifications/reminders",
        { method: "POST", body: { bookingId } },
      );
      setBookings((prev) =>
        prev.map((b) =>
          b.bookingId === bookingId
            ? {
                ...b,
                reminderStatus: data.notification.status,
                reminderNotificationId: data.notification.notificationId,
              }
            : b,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reminder");
    } finally {
      setBusyId(null);
    }
  }

  async function generateAll() {
    setError(null);
    setInfo(null);
    setGenerating(true);
    try {
      const data = await apiRequest<{
        result: { sent: number; failed: number; skipped: number };
      }>("/api/notifications/reminders", {
        method: "POST",
        body: { all: true },
      });
      const { sent, failed, skipped } = data.result;
      setInfo(`Reminders: ${sent} sent, ${failed} failed, ${skipped} skipped.`);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate reminders",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          Bookings in the next 7 days. Send a reminder per row, or generate for
          all eligible bookings at once.
        </Typography>
        {canWrite && (
          <Button
            variant="contained"
            startIcon={<NotificationsActiveIcon />}
            onClick={() => void generateAll()}
            disabled={generating || bookings.length === 0}
          >
            {generating ? "Generating…" : "Generate reminders"}
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setInfo(null)}>
          {info}
        </Alert>
      )}

      {/* Generate reminders sends every eligible booking the moment it is
          pressed, which is exactly what a note asking for a specific time is
          trying to prevent. Saying so here is the difference between the note
          being honoured and it being quietly overrun. */}
      {canWrite && timed.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {timed.length === 1
            ? "One booking asks for its reminder at a set time."
            : `${timed.length} bookings ask for their reminders at a set time.`}{" "}
          Generate reminders sends all of them now. Use Send on the row when the
          time comes instead.
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Patient</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Booking</TableCell>
              <TableCell>Reminder</TableCell>
              {canWrite && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 6 : 5} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No upcoming bookings in the next 7 days.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((b) => {
                const sendAt = parseSendAtNote(b.notes);
                const unreadable = !sendAt && hasSendAtNote(b.notes);
                const spent = alreadySent(b);
                return (
                  <TableRow key={b.bookingId} hover>
                    <TableCell>{formatDateTime(b.startsAt)}</TableCell>
                    <TableCell>{b.patientName}</TableCell>
                    <TableCell>{b.clientName}</TableCell>
                    <TableCell>
                      <Chip size="small" label={b.bookingStatus} />
                    </TableCell>
                    {/* The send time sits with the reminder rather than with
                      the appointment: it is an instruction about this column,
                      and a second time in the When cell would read as the
                      booking having moved. It also lands right beside the Send
                      button, in the same glance as the press. */}
                    <TableCell>
                      <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                        {b.reminderStatus ? (
                          <Chip
                            size="small"
                            color={NOTIFICATION_STATUS_COLOR[b.reminderStatus]}
                            label={b.reminderStatus}
                          />
                        ) : (
                          <Chip
                            size="small"
                            variant="outlined"
                            label="Not sent"
                          />
                        )}
                        {(sendAt || unreadable) && (
                          <Tooltip title={b.notes ?? ""}>
                            <Chip
                              size="small"
                              color="warning"
                              // Loud while it is still an instruction; quieter
                              // once the reminder has gone, where it is a record
                              // that the note was overtaken rather than a thing
                              // to act on.
                              variant={spent ? "outlined" : "filled"}
                              icon={<ScheduleIcon fontSize="small" />}
                              label={
                                sendAt
                                  ? `Send at ${sendAt.label}`
                                  : "Check send time"
                              }
                            />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    {canWrite && (
                      <TableCell align="right">
                        <Tooltip
                          title={
                            b.reminderStatus === "Sent" ||
                            b.reminderStatus === "Delivered"
                              ? "Reminder already sent"
                              : "Send reminder"
                          }
                        >
                          <span>
                            <Button
                              size="small"
                              startIcon={<SendIcon fontSize="small" />}
                              onClick={() => void sendOne(b.bookingId)}
                              disabled={
                                busyId === b.bookingId ||
                                b.reminderStatus === "Sent" ||
                                b.reminderStatus === "Delivered" ||
                                b.reminderStatus === "Pending"
                              }
                            >
                              {b.reminderStatus === "Failed" ? "Retry" : "Send"}
                            </Button>
                          </span>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
