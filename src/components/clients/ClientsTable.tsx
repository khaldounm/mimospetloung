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
import type { ClientDTO } from "@/types/entities";
import ClientFormDialog from "./ClientFormDialog";

interface Props {
  initialClients: ClientDTO[];
  canWrite: boolean;
}

export default function ClientsTable({ initialClients, canWrite }: Props) {
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const firstRender = useRef(true);

  async function load(q: string) {
    const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    const data = await apiRequest<{ clients: ClientDTO[] }>(
      `/api/clients${params}`,
    );
    setClients(data.clients);
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
        <Typography variant="h4">Clients</Typography>
        <Stack direction="row" spacing={1}>
          <Button component={Link} href="/patients" variant="outlined">
            Patients
          </Button>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
            >
              New client
            </Button>
          )}
        </Stack>
      </Stack>

      <TextField
        placeholder="Search by name, email, or phone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Email</TableCell>
              <TableCell align="right">Patients</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No clients found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((c) => (
                <TableRow key={c.clientId} hover>
                  <TableCell>
                    <Link href={`/clients/${c.clientId}`}>
                      {c.firstName} {c.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{c.phone ?? "-"}</TableCell>
                  <TableCell>{c.email ?? "-"}</TableCell>
                  <TableCell align="right">{c.patientCount ?? 0}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ClientFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load(query)}
      />
    </Box>
  );
}
