"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import { apiRequest } from "@/utils/api-client";
import { formatDateTime } from "@/utils/format";
import { CONTACT_MESSAGE_STATUSES } from "@/types/enums";
import type { ContactMessageStatus } from "@/types/enums";
import type { ContactMessageDTO } from "@/types/entities";

const STATUS_COLOR: Record<
  ContactMessageStatus,
  "warning" | "default" | "info"
> = {
  New: "warning",
  Read: "info",
  Archived: "default",
};

type Filter = "All" | ContactMessageStatus;
const FILTERS: Filter[] = ["All", ...CONTACT_MESSAGE_STATUSES];

interface Props {
  initialMessages: ContactMessageDTO[];
  canWrite: boolean;
}

export default function MessagesView({ initialMessages, canWrite }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [filter, setFilter] = useState<Filter>("All");
  const [selected, setSelected] = useState<ContactMessageDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newCount = useMemo(
    () => messages.filter((m) => m.status === "New").length,
    [messages],
  );

  const visible = useMemo(
    () =>
      filter === "All" ? messages : messages.filter((m) => m.status === filter),
    [messages, filter],
  );

  async function setStatus(
    message: ContactMessageDTO,
    status: ContactMessageStatus,
  ) {
    if (!canWrite || message.status === status) return;
    setError(null);
    setBusy(true);
    try {
      const data = await apiRequest<{ message: ContactMessageDTO }>(
        `/api/messages/${message.messageId}`,
        { method: "PATCH", body: { status } },
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === data.message.messageId ? data.message : m,
        ),
      );
      setSelected((cur) =>
        cur && cur.messageId === data.message.messageId ? data.message : cur,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update message");
    } finally {
      setBusy(false);
    }
  }

  function openMessage(message: ContactMessageDTO) {
    setSelected(message);
    // Opening an unread enquiry marks it read.
    if (message.status === "New") void setStatus(message, "Read");
  }

  return (
    <Box>
      <Tabs
        value={filter}
        onChange={(_, v: Filter) => setFilter(v)}
        sx={{ mb: 2 }}
      >
        {FILTERS.map((f) => (
          <Tab
            key={f}
            value={f}
            label={f === "New" && newCount > 0 ? `New (${newCount})` : f}
          />
        ))}
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>From</TableCell>
              <TableCell>Pet</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Received</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No messages here.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((m) => (
                <TableRow
                  key={m.messageId}
                  hover
                  onClick={() => openMessage(m)}
                  sx={{
                    cursor: "pointer",
                    "& td": { fontWeight: m.status === "New" ? 600 : 400 },
                  }}
                >
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[m.status]}
                      label={m.status}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: "inherit" }}>
                      {m.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {[m.petName, m.petType].filter(Boolean).join(", ") || "-"}
                  </TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 320,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.message}
                  </TableCell>
                  <TableCell>{formatDateTime(m.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        maxWidth="sm"
        fullWidth
      >
        {selected && (
          <>
            <DialogTitle
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box>
                {selected.name}
                <Chip
                  size="small"
                  color={STATUS_COLOR[selected.status]}
                  label={selected.status}
                  sx={{ ml: 1.5 }}
                />
              </Box>
              <IconButton size="small" onClick={() => setSelected(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  spacing={3}
                  sx={{ flexWrap: "wrap", color: "text.secondary" }}
                >
                  <Box>
                    <Typography variant="caption" sx={{ display: "block" }}>
                      Email
                    </Typography>
                    <Link href={`mailto:${selected.email}`}>
                      {selected.email}
                    </Link>
                  </Box>
                  {selected.phone && (
                    <Box>
                      <Typography variant="caption" sx={{ display: "block" }}>
                        Phone
                      </Typography>
                      <Link href={`tel:${selected.phone}`}>
                        {selected.phone}
                      </Link>
                    </Box>
                  )}
                  {(selected.petName || selected.petType) && (
                    <Box>
                      <Typography variant="caption" sx={{ display: "block" }}>
                        Pet
                      </Typography>
                      <Typography variant="body2">
                        {[selected.petName, selected.petType]
                          .filter(Boolean)
                          .join(", ")}
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" sx={{ display: "block" }}>
                      Received
                    </Typography>
                    <Typography variant="body2">
                      {formatDateTime(selected.createdAt)}
                    </Typography>
                  </Box>
                </Stack>
                <Typography
                  variant="body1"
                  sx={{ whiteSpace: "pre-wrap", mt: 1 }}
                >
                  {selected.message}
                </Typography>
              </Stack>
            </DialogContent>
            {canWrite && (
              <DialogActions>
                {selected.status === "Archived" ? (
                  <Button
                    startIcon={<UnarchiveIcon />}
                    onClick={() => void setStatus(selected, "Read")}
                    disabled={busy}
                  >
                    Restore
                  </Button>
                ) : (
                  <Button
                    startIcon={<ArchiveIcon />}
                    onClick={() => void setStatus(selected, "Archived")}
                    disabled={busy}
                  >
                    Archive
                  </Button>
                )}
              </DialogActions>
            )}
          </>
        )}
      </Dialog>
    </Box>
  );
}
