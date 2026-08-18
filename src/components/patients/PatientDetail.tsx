"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { apiRequest } from "@/utils/api-client";
import { formatDate } from "@/utils/format";
import type {
  ClinicalRecordDTO,
  PatientDTO,
  ServicePickerOption,
} from "@/types/entities";
import PatientFormDialog from "./PatientFormDialog";
import AddRecordDialog from "./AddRecordDialog";
import ClinicalTimeline from "./ClinicalTimeline";

interface Props {
  patient: PatientDTO;
  clientName: string;
  initialRecords: ClinicalRecordDTO[];
  services: ServicePickerOption[];
  canWritePatient: boolean;
  canReadClinical: boolean;
  canWriteClinical: boolean;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{value || "-"}</Typography>
    </Box>
  );
}

export default function PatientDetail({
  patient,
  clientName,
  initialRecords,
  services,
  canWritePatient,
  canReadClinical,
  canWriteClinical,
}: Props) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [editOpen, setEditOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reloadRecords() {
    const data = await apiRequest<{ records: ClinicalRecordDTO[] }>(
      `/api/patients/${patient.patientId}/records`,
    );
    setRecords(data.records);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await apiRequest(`/api/patients/${patient.patientId}`, {
        method: "DELETE",
      });
      router.push("/patients");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  const upcoming = records
    .filter((r) => {
      const today = new Date().toISOString().slice(0, 10);
      return r.nextDueDate && r.nextDueDate >= today;
    })
    .sort((a, b) => (a.nextDueDate ?? "").localeCompare(b.nextDueDate ?? ""));

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Box>
          <Typography variant="h4">{patient.name}</Typography>
          <Typography color="text.secondary">
            Owner:{" "}
            <Link href={`/clients/${patient.clientId}`}>{clientName}</Link>
          </Typography>
        </Box>
        {canWritePatient && (
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setConfirmOpen(true)}
            >
              Delete
            </Button>
          </Stack>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Field label="Species" value={patient.species} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Field label="Breed" value={patient.breed} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Field
              label="Date of birth"
              value={formatDate(patient.dateOfBirth)}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Field label="Sex" value={patient.sex} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Field
              label="Neutered / spayed"
              value={patient.isNeutered ? "Yes" : "No"}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Field label="Microchip ID" value={patient.microchipId} />
          </Grid>
          {patient.notes && (
            <Grid size={12}>
              <Field label="Notes" value={patient.notes} />
            </Grid>
          )}
        </Grid>
      </Paper>

      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h5">Clinical history</Typography>
        {canWriteClinical && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setRecordOpen(true)}
          >
            Add record
          </Button>
        )}
      </Stack>

      {!canReadClinical ? (
        <Alert severity="info">
          You do not have permission to view clinical records.
        </Alert>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", alignItems: "center" }}
              >
                <span>Upcoming:</span>
                {upcoming.map((r) => (
                  <Chip
                    key={r.recordId}
                    size="small"
                    label={`${r.title} (${formatDate(r.nextDueDate)})`}
                  />
                ))}
              </Stack>
            </Alert>
          )}
          <ClinicalTimeline
            records={records}
            patientId={patient.patientId}
            services={services}
            canWrite={canWriteClinical}
            onChanged={() => void reloadRecords()}
          />
        </>
      )}

      <PatientFormDialog
        open={editOpen}
        patient={patient}
        onClose={() => setEditOpen(false)}
        onSaved={() => router.refresh()}
      />
      <AddRecordDialog
        open={recordOpen}
        patientId={patient.patientId}
        services={services}
        onClose={() => setRecordOpen(false)}
        onSaved={() => void reloadRecords()}
      />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete patient?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This soft-deletes {patient.name}. The record is retained and can be
            restored by an administrator.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Divider sx={{ mt: 4 }} />
    </Box>
  );
}
