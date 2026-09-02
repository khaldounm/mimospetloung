"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { apiRequest } from "@/utils/api-client";
import { AUDIT_RETENTION_DAYS } from "@/constants/audit";

// The phrase that has to be typed out. Not "yes" and not a checkbox: this
// deletes history nothing else in the app records, so the confirmation is
// deliberately something you cannot do by reflex.
const CONFIRM_PHRASE = "DELETE LOGS";

interface Preview {
  prunable: number;
  cutoff: string;
  olderThanDays: number;
}

// Clearing old audit entries. Kept apart from the rest of Settings and styled as
// a danger zone, because it is the only control on the page that destroys
// anything, and the only one with no undo.
export default function DeleteLogsCard() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const armed = typed === CONFIRM_PHRASE;

  async function openDialog() {
    setTyped("");
    setError(null);
    setDone(null);
    setPreview(null);
    setOpen(true);
    setLoading(true);
    try {
      // Counted now rather than at page load, so the number on screen is the
      // number that will actually go.
      setPreview(await apiRequest<Preview>("/api/settings/audit-log"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not count entries");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    setError(null);
    setWorking(true);
    try {
      const res = await apiRequest<{ deleted: number }>(
        `/api/settings/audit-log?confirm=${encodeURIComponent(CONFIRM_PHRASE)}`,
        { method: "DELETE" },
      );
      setDone(
        res.deleted === 0
          ? "Nothing was old enough to delete."
          : `Deleted ${res.deleted.toLocaleString()} audit ${
              res.deleted === 1 ? "entry" : "entries"
            }.`,
      );
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete logs");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          height: "100%",
          borderColor: "error.main",
          borderWidth: 2,
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <WarningAmberIcon color="error" />
            <Typography variant="h6" color="error.main">
              Danger zone
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            The audit log records who changed what, and when: every invoice
            edit, every payment, every price change. Deleting it removes the
            only record of those changes. Nothing else in the app keeps a copy,
            and there is no undo.
          </Typography>

          <Typography variant="body2" color="text.secondary">
            This removes entries older than {AUDIT_RETENTION_DAYS} days. The
            last {AUDIT_RETENTION_DAYS} days are always kept.
          </Typography>

          {done && <Alert severity="success">{done}</Alert>}
          {error && !open && <Alert severity="error">{error}</Alert>}

          <Button
            variant="contained"
            color="error"
            size="large"
            startIcon={<DeleteForeverIcon />}
            onClick={() => void openDialog()}
            sx={{
              alignSelf: "flex-start",
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "0.04em",
              px: 3,
              py: 1.5,
            }}
          >
            DELETE LOGS
          </Button>
        </Stack>
      </Paper>

      <Dialog
        open={open}
        onClose={() => !working && setOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ color: "error.main" }}>
          Delete audit logs?
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <DialogContentText component="div">
              {loading && "Counting entries…"}
              {preview && (
                <>
                  This permanently deletes{" "}
                  <strong>
                    {preview.prunable.toLocaleString()}{" "}
                    {preview.prunable === 1 ? "entry" : "entries"}
                  </strong>{" "}
                  older than {preview.olderThanDays} days. It cannot be undone.
                </>
              )}
            </DialogContentText>

            {error && <Alert severity="error">{error}</Alert>}

            <DialogContentText component="div">
              Type <strong>{CONFIRM_PHRASE}</strong> to confirm.
            </DialogContentText>
            <TextField
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
              autoFocus
              fullWidth
              slotProps={{ htmlInput: { "aria-label": "Confirmation phrase" } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={working}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void confirm()}
            disabled={!armed || working || loading}
          >
            {working ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
