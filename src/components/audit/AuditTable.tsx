"use client";

import { useState } from "react";
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import { apiRequest } from "@/utils/api-client";
import { formatDateTime } from "@/utils/format";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_COLOR,
  AUDIT_ENTITIES,
  AUDIT_ENTITY_LABELS,
} from "@/constants/audit";
import type { AuditLogDTO } from "@/types/entities";

interface UserOption {
  userId: number;
  label: string;
}

interface Props {
  initialLogs: AuditLogDTO[];
  users: UserOption[];
}

export default function AuditTable({ initialLogs, users }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditLogDTO | null>(null);

  async function applyFilters() {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entity) params.set("entity", entity);
      if (action) params.set("action", action);
      if (userId) params.set("userId", userId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const data = await apiRequest<{ logs: AuditLogDTO[] }>(
        `/api/audit${qs ? `?${qs}` : ""}`,
      );
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setEntity("");
    setAction("");
    setUserId("");
    setFrom("");
    setTo("");
    setLogs(initialLogs);
    setError(null);
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { md: "center" }, flexWrap: "wrap" }}
      >
        <TextField
          select
          size="small"
          label="Entity"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          {AUDIT_ENTITIES.map((e) => (
            <MenuItem key={e} value={e}>
              {AUDIT_ENTITY_LABELS[e]}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All</MenuItem>
          {AUDIT_ACTIONS.map((a) => (
            <MenuItem key={a} value={a} sx={{ textTransform: "capitalize" }}>
              {a}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="User"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All</MenuItem>
          {users.map((u) => (
            <MenuItem key={u.userId} value={String(u.userId)}>
              {u.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          type="date"
          size="small"
          label="From"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type="date"
          size="small"
          label="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Button
          variant="contained"
          onClick={() => void applyFilters()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Apply"}
        </Button>
        <Button onClick={resetFilters} disabled={loading}>
          Reset
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell align="right">ID</TableCell>
              <TableCell align="right">Changes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No audit entries match these filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.auditId} hover>
                  <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>{log.userName ?? "System"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={
                        AUDIT_ACTION_COLOR[
                          log.action as keyof typeof AUDIT_ACTION_COLOR
                        ] ?? "default"
                      }
                      label={log.action}
                      sx={{ textTransform: "capitalize" }}
                    />
                  </TableCell>
                  <TableCell>
                    {AUDIT_ENTITY_LABELS[
                      log.entity as keyof typeof AUDIT_ENTITY_LABELS
                    ] ?? log.entity}
                  </TableCell>
                  <TableCell align="right">{log.entityId}</TableCell>
                  <TableCell align="right">
                    {log.changes != null ? (
                      <Tooltip title="View changes">
                        <IconButton size="small" onClick={() => setDetail(log)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {detail
            ? `${detail.action} ${
                AUDIT_ENTITY_LABELS[
                  detail.entity as keyof typeof AUDIT_ENTITY_LABELS
                ] ?? detail.entity
              } #${detail.entityId}`
            : "Changes"}
          <IconButton size="small" onClick={() => setDetail(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              borderRadius: 1,
              bgcolor: "action.hover",
              fontSize: 13,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {detail ? JSON.stringify(detail.changes, null, 2) : ""}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
