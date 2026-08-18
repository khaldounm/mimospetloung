"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Chip,
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
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { apiRequest } from "@/utils/api-client";
import { formatDate, formatMoney } from "@/utils/format";
import { INVOICE_STATUS_COLOR } from "@/constants/invoice";
import { INVOICE_STATUSES } from "@/types/enums";
import type { InvoiceDTO, InvoiceListItemDTO } from "@/types/entities";
import InvoiceFormDialog, { type ClientOption } from "./InvoiceFormDialog";

interface Props {
  initialInvoices: InvoiceListItemDTO[];
  clientOptions: ClientOption[];
  canWrite: boolean;
}

export default function InvoicesTable({
  initialInvoices,
  clientOptions,
  canWrite,
}: Props) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [status, setStatus] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const firstRender = useRef(true);

  async function load(s: string) {
    const qs = s ? `?status=${encodeURIComponent(s)}` : "";
    const data = await apiRequest<{ invoices: InvoiceListItemDTO[] }>(
      `/api/invoices${qs}`,
    );
    setInvoices(data.invoices);
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => void load(status), 200);
    return () => clearTimeout(t);
  }, [status]);

  function handleCreated(invoice: InvoiceDTO) {
    router.push(`/invoices/${invoice.invoiceId}`);
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h4">Invoices</Typography>
        <Stack direction="row" spacing={1}>
          <Button component={Link} href="/services" variant="outlined">
            Services
          </Button>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
            >
              New invoice
            </Button>
          )}
        </Stack>
      </Stack>

      <TextField
        select
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        size="small"
        sx={{ mb: 2, minWidth: 200 }}
      >
        <MenuItem value="">All</MenuItem>
        {INVOICE_STATUSES.map((s) => (
          <MenuItem key={s} value={s}>
            {s}
          </MenuItem>
        ))}
      </TextField>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Number</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell>Due</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No invoices found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.invoiceId} hover>
                  <TableCell>
                    <Link href={`/invoices/${inv.invoiceId}`}>
                      {inv.number}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.clientName}</TableCell>
                  <TableCell>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Chip
                        size="small"
                        color={INVOICE_STATUS_COLOR[inv.status]}
                        label={inv.status}
                      />
                      {inv.isOverdue && (
                        <Chip size="small" color="error" label="Overdue" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{formatMoney(inv.total)}</TableCell>
                  <TableCell align="right">
                    {formatMoney(inv.balance)}
                  </TableCell>
                  <TableCell>
                    {inv.dueDate ? formatDate(inv.dueDate) : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <InvoiceFormDialog
        open={dialogOpen}
        clientOptions={clientOptions}
        onClose={() => setDialogOpen(false)}
        onSaved={handleCreated}
      />
    </Box>
  );
}
