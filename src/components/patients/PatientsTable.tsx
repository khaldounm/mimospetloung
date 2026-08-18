"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { apiRequest } from "@/utils/api-client";
import type { PatientDTO } from "@/types/entities";
import PatientFormDialog, { type ClientOption } from "./PatientFormDialog";

interface Props {
  initialPatients: PatientDTO[];
  clientOptions: ClientOption[];
  canWrite: boolean;
}

export default function PatientsTable({
  initialPatients,
  clientOptions,
  canWrite,
}: Props) {
  const [patients, setPatients] = useState(initialPatients);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const firstRender = useRef(true);

  async function load(q: string) {
    const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    const data = await apiRequest<{ patients: PatientDTO[] }>(
      `/api/patients${params}`,
    );
    setPatients(data.patients);
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => void load(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h4">Patients</Typography>
        <Stack direction="row" spacing={1}>
          <Button component={Link} href="/clients" variant="outlined">
            Clients
          </Button>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
            >
              New patient
            </Button>
          )}
        </Stack>
      </Stack>

      <TextField
        placeholder="Search by name, species, breed, or microchip"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <TableContainer component={Paper}>
        <Table sx={{ tableLayout: "fixed" }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: "30%" }}>Name</TableCell>
              <TableCell sx={{ width: "20%" }}>Species</TableCell>
              <TableCell sx={{ width: "25%" }}>Breed</TableCell>
              <TableCell sx={{ width: "25%" }}>Owner</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No patients found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              patients.map((p) => (
                <TableRow key={p.patientId} hover>
                  <TableCell>
                    <Link href={`/patients/${p.patientId}`}>{p.name}</Link>
                  </TableCell>
                  <TableCell>{p.species ?? "-"}</TableCell>
                  <TableCell>{p.breed ?? "-"}</TableCell>
                  <TableCell>{p.clientName ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <PatientFormDialog
        open={dialogOpen}
        clientOptions={clientOptions}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load(query)}
      />
    </Box>
  );
}
