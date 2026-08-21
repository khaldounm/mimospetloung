"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
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
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { apiRequest } from "@/utils/api-client";
import { formatAccountBalance } from "@/utils/format";
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
  initialInDebtCount: number;
  initialInCreditCount: number;
  canWrite: boolean;
}

export default function ClientsTable({
  initialClients,
  initialTotal,
  pageSize,
  letters,
  initialReviewCount,
  initialInDebtCount,
  initialInCreditCount,
  canWrite,
}: Props) {
  const [clients, setClients] = useState(initialClients);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0); // zero-based, matching the pager
  const [reviewCount, setReviewCount] = useState(initialReviewCount);
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  // Unsettled accounts: whoever owes the clinic, or whoever is in credit.
  const [balance, setBalance] = useState<"debt" | "credit" | null>(null);
  const [inDebtCount, setInDebtCount] = useState(initialInDebtCount);
  const [inCreditCount, setInCreditCount] = useState(initialInCreditCount);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const firstRender = useRef(true);

  async function load(
    q: string,
    l: string | null,
    p: number,
    review: boolean,
    bal: "debt" | "credit" | null,
  ) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (l) params.set("letter", l);
    if (review) params.set("review", "1");
    if (bal) params.set("balance", bal);
    params.set("page", String(p + 1));
    setLoading(true);
    try {
      const data = await apiRequest<{
        clients: ClientDTO[];
        total: number;
        reviewCount: number;
        inDebtCount: number;
        inCreditCount: number;
      }>(`/api/clients?${params}`);
      setClients(data.clients);
      setTotal(data.total);
      setReviewCount(data.reviewCount);
      setInDebtCount(data.inDebtCount);
      setInCreditCount(data.inCreditCount);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(
      () => void load(query, letter, page, reviewOnly, balance),
      300,
    );
    return () => clearTimeout(t);
  }, [query, letter, page, reviewOnly, balance]);

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
        {/* Counted over the whole table, not the page, so the numbers read the
            same whatever else is filtered. */}
        <Chip
          label={`In debt (${inDebtCount})`}
          color={balance === "debt" ? "warning" : "default"}
          variant={balance === "debt" ? "filled" : "outlined"}
          onClick={() =>
            changeFilter(() =>
              setBalance((b) => (b === "debt" ? null : "debt")),
            )
          }
          disabled={loading}
        />
        <Chip
          label={`In credit (${inCreditCount})`}
          color={balance === "credit" ? "info" : "default"}
          variant={balance === "credit" ? "filled" : "outlined"}
          onClick={() =>
            changeFilter(() =>
              setBalance((b) => (b === "credit" ? null : "credit")),
            )
          }
          disabled={loading}
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
              <TableCell align="right">Balance</TableCell>
              <TableCell align="right">Patients</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    {reviewOnly
                      ? "Nothing left to review."
                      : balance === "debt"
                        ? "Nobody owes the clinic anything."
                        : balance === "credit"
                          ? "Nobody is sitting in credit."
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
                  <TableCell align="right">
                    {c.accountBalance != null &&
                    Number(c.accountBalance) !== 0 ? (
                      <Typography
                        variant="body2"
                        color={
                          Number(c.accountBalance) > 0
                            ? "warning.main"
                            : "info.main"
                        }
                      >
                        {formatAccountBalance(c.accountBalance).text}
                      </Typography>
                    ) : (
                      "-"
                    )}
                  </TableCell>
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
        onSaved={() => void load(query, letter, page, reviewOnly, balance)}
      />
    </Box>
  );
}
