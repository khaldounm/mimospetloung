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
import AlphabetBar from "@/components/ui/AlphabetBar";
import TablePaginationBar from "@/components/ui/TablePaginationBar";
import type { ClientDTO } from "@/types/entities";
import ClientFormDialog from "./ClientFormDialog";
import ReviewBadge from "@/components/ui/ReviewBadge";
import ReviewFilterChip from "@/components/ui/ReviewFilterChip";

interface Props {
  initialClients: ClientDTO[];
  initialTotal: number;
  pageSize: number;
  letters: { letter: string; count: number }[];
  initialReviewCount: number;
  canWrite: boolean;
}

export default function ClientsTable({
  initialClients,
  initialTotal,
  pageSize,
  letters,
  initialReviewCount,
  canWrite,
}: Props) {
  const [clients, setClients] = useState(initialClients);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0); // zero-based, matching the pager
  const [reviewCount, setReviewCount] = useState(initialReviewCount);
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const firstRender = useRef(true);

  async function load(q: string, l: string | null, p: number, review: boolean) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (l) params.set("letter", l);
    if (review) params.set("review", "1");
    params.set("page", String(p + 1));
    setLoading(true);
    try {
      const data = await apiRequest<{
        clients: ClientDTO[];
        total: number;
        reviewCount: number;
      }>(`/api/clients?${params}`);
      setClients(data.clients);
      setTotal(data.total);
      setReviewCount(data.reviewCount);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => void load(query, letter, page, reviewOnly), 300);
    return () => clearTimeout(t);
  }, [query, letter, page, reviewOnly]);

  // A new filter invalidates the current offset.
  function changeFilter(next: () => void) {
    setPage(0);
    next();
  }

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

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mb: 2, alignItems: { sm: "center" } }}
      >
        <TextField
          placeholder="Search by name, email, or phone"
          value={query}
          onChange={(e) => changeFilter(() => setQuery(e.target.value))}
          fullWidth
          size="small"
        />
        <ReviewFilterChip
          count={reviewCount}
          active={reviewOnly}
          onToggle={(next) => changeFilter(() => setReviewOnly(next))}
          noun="clients"
        />
      </Stack>

      <AlphabetBar
        letters={letters}
        noun="clients"
        value={letter}
        onChange={(next) => changeFilter(() => setLetter(next))}
        disabled={loading}
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
                    {reviewOnly
                      ? "Nothing left to review."
                      : "No clients found."}
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
                    <ReviewBadge
                      needsReview={c.needsReview}
                      note={c.reviewNote}
                    />
                  </TableCell>
                  <TableCell>{c.phone ?? "-"}</TableCell>
                  <TableCell>{c.email ?? "-"}</TableCell>
                  <TableCell align="right">{c.patientCount ?? 0}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePaginationBar
          page={page}
          count={total}
          pageSize={pageSize}
          onChange={setPage}
          loading={loading}
          noun="clients"
        />
      </TableContainer>

      <ClientFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load(query, letter, page, reviewOnly)}
      />
    </Box>
  );
}
