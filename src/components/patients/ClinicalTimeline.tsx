"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { formatDate } from "@/utils/format";
import { apiRequest } from "@/utils/api-client";
import type { ClinicalRecordDTO, ServicePickerOption } from "@/types/entities";
import type { RecordType } from "@/types/enums";
import EditRecordDialog from "./EditRecordDialog";

const TYPE_COLORS: Record<
  RecordType,
  "primary" | "success" | "secondary" | "warning"
> = {
  Consultation: "primary",
  Vaccination: "success",
  Grooming: "secondary",
  Treatment: "warning",
};

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function DetailList({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return null;
  const entries = Object.entries(details).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== "",
  );
  if (entries.length === 0) return null;
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      {entries.map(([k, v]) => (
        <Typography key={k} variant="body2">
          <strong>{humanize(k)}:</strong> {String(v)}
        </Typography>
      ))}
    </Stack>
  );
}

interface Props {
  records: ClinicalRecordDTO[];
  patientId: number;
  services: ServicePickerOption[];
  canWrite: boolean;
  onChanged: () => void;
}

export default function ClinicalTimeline({
  records,
  patientId,
  services,
  canWrite,
  onChanged,
}: Props) {
  const [editRecord, setEditRecord] = useState<ClinicalRecordDTO | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<ClinicalRecordDTO | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleteRecord) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest(
        `/api/patients/${patientId}/records/${deleteRecord.recordId}`,
        { method: "DELETE" },
      );
      setDeleteRecord(null);
      onChanged();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  if (records.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        No clinical records yet.
      </Typography>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Stack spacing={2}>
        {records.map((r) => {
          const upcoming = r.nextDueDate && r.nextDueDate >= today;
          return (
            <Paper key={r.recordId} variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Chip
                      label={r.recordType}
                      color={TYPE_COLORS[r.recordType]}
                      size="small"
                    />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {r.title}
                      </Typography>
                      {r.subcategory && r.subcategory !== r.title && (
                        <Typography variant="body2" color="text.secondary">
                          {r.subcategory}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  {r.notes && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {r.notes}
                    </Typography>
                  )}
                  <DetailList details={r.details} />
                </Box>
                <Stack
                  spacing={0.5}
                  sx={{ flexShrink: 0, alignItems: "flex-end" }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(r.performedAt)}
                    </Typography>
                    {r.performerName && (
                      <Typography variant="caption" sx={{ display: "block" }}>
                        {r.performerName}
                      </Typography>
                    )}
                  </Box>
                  {canWrite && (
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => setEditRecord(r)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteRecord(r)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                </Stack>
              </Stack>
              {r.nextDueDate && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Chip
                    size="small"
                    variant={upcoming ? "filled" : "outlined"}
                    color={upcoming ? "warning" : "default"}
                    label={`Next due: ${formatDate(r.nextDueDate)}`}
                  />
                </>
              )}
            </Paper>
          );
        })}
      </Stack>

      {editRecord && (
        <EditRecordDialog
          open
          record={editRecord}
          patientId={patientId}
          services={services}
          onClose={() => setEditRecord(null)}
          onSaved={() => {
            setEditRecord(null);
            onChanged();
          }}
        />
      )}

      <Dialog
        open={Boolean(deleteRecord)}
        onClose={() => !deleting && setDeleteRecord(null)}
      >
        <DialogTitle>Delete record?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will soft-delete &quot;{deleteRecord?.title}&quot;. It can be
            restored by an administrator if needed.
          </DialogContentText>
          {deleteError && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {deleteError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteRecord(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
