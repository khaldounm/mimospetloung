"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SendIcon from "@mui/icons-material/Send";
import ReplayIcon from "@mui/icons-material/Replay";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { apiRequest } from "@/utils/api-client";
import { formatDateTime } from "@/utils/format";
import { NOTIFICATION_STATUS_COLOR } from "@/constants/notification";
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES } from "@/types/enums";
import type { NotificationDTO } from "@/types/entities";
import ComposeNotificationDialog, {
  type BookingOption,
  type ClientOption,
  type PatientOption,
  type TemplateOption,
} from "./ComposeNotificationDialog";

interface Props {
  initialNotifications: NotificationDTO[];
  clientOptions: ClientOption[];
  patientOptions: PatientOption[];
  bookingOptions: BookingOption[];
  templateOptions: TemplateOption[];
  canWrite: boolean;
}

export default function NotificationsTable({
  initialNotifications,
  clientOptions,
  patientOptions,
  bookingOptions,
  templateOptions,
  canWrite,
}: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [detail, setDetail] = useState<NotificationDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);

  async function load(s: string, c: string) {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (c) params.set("channel", c);
    const qs = params.toString();
    const data = await apiRequest<{ notifications: NotificationDTO[] }>(
      `/api/notifications${qs ? `?${qs}` : ""}`,
    );
    setNotifications(data.notifications);
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => void load(status, channel), 200);
    return () => clearTimeout(t);
  }, [status, channel]);

  function upsert(n: NotificationDTO) {
    setNotifications((prev) =>
      prev.some((x) => x.notificationId === n.notificationId)
        ? prev.map((x) => (x.notificationId === n.notificationId ? n : x))
        : [n, ...prev],
    );
  }

  async function act(
    notificationId: number,
    action: "send" | "retry" | "cancel",
  ) {
    setError(null);
    try {
      const data = await apiRequest<{ notification: NotificationDTO }>(
        `/api/notifications/${notificationId}`,
        { method: "PATCH", body: { action } },
      );
      upsert(data.notification);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Stack direction="row" spacing={2}>
          <TextField
            select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All</MenuItem>
            {NOTIFICATION_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All</MenuItem>
            {NOTIFICATION_CHANNELS.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {canWrite && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setComposeOpen(true)}
          >
            Compose
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Created</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Patient</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Recipient</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Scheduled</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No notifications found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((n) => (
                <TableRow key={n.notificationId} hover>
                  <TableCell>{formatDateTime(n.createdAt)}</TableCell>
                  <TableCell>{n.clientName}</TableCell>
                  <TableCell>{n.patientName ?? "-"}</TableCell>
                  <TableCell>{n.channel ?? "-"}</TableCell>
                  <TableCell>{n.recipient}</TableCell>
                  <TableCell>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center" }}
                    >
                      <Chip
                        size="small"
                        color={NOTIFICATION_STATUS_COLOR[n.status]}
                        label={n.status}
                      />
                      {n.retryCount > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          x{n.retryCount}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {n.scheduledAt ? formatDateTime(n.scheduledAt) : "-"}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View message">
                      <IconButton size="small" onClick={() => setDetail(n)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canWrite && n.status === "Pending" && (
                      <>
                        <Tooltip title="Send now">
                          <IconButton
                            size="small"
                            onClick={() => void act(n.notificationId, "send")}
                          >
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <IconButton
                            size="small"
                            onClick={() => void act(n.notificationId, "cancel")}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {canWrite && n.status === "Failed" && (
                      <Tooltip title="Retry">
                        <IconButton
                          size="small"
                          onClick={() => void act(n.notificationId, "retry")}
                        >
                          <ReplayIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ComposeNotificationDialog
        open={composeOpen}
        clientOptions={clientOptions}
        patientOptions={patientOptions}
        bookingOptions={bookingOptions}
        templateOptions={templateOptions}
        onClose={() => setComposeOpen(false)}
        onSaved={upsert}
      />

      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Message</DialogTitle>
        <DialogContent>
          {detail && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {detail.channel} to {detail.recipient}
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, whiteSpace: "pre-wrap" }}>
                {detail.body}
              </Paper>
              {detail.sentAt && (
                <Typography variant="body2" color="text.secondary">
                  Sent {formatDateTime(detail.sentAt)}
                </Typography>
              )}
              {detail.errorMessage && (
                <Alert severity="error">{detail.errorMessage}</Alert>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
