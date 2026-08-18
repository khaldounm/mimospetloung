"use client";

import { useState } from "react";
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
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PaymentsIcon from "@mui/icons-material/Payments";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import BlockIcon from "@mui/icons-material/Block";
import { apiRequest } from "@/utils/api-client";
import { formatDate, formatDateTime, formatMoney } from "@/utils/format";
import { printInvoiceReceipt } from "@/utils/print-receipt";
import { downloadReceiptImage } from "@/utils/receipt-image";
import { INVOICE_STATUS_COLOR } from "@/constants/invoice";
import type { InvoiceDTO, InvoiceLineItemDTO } from "@/types/entities";
import InvoiceFormDialog, { type ClientOption } from "./InvoiceFormDialog";
import LineItemDialog, {
  type ItemLineOption,
  type ServiceLineOption,
} from "./LineItemDialog";
import PaymentDialog from "./PaymentDialog";

interface Props {
  invoice: InvoiceDTO;
  clientOptions: ClientOption[];
  serviceOptions: ServiceLineOption[];
  itemOptions: ItemLineOption[];
  canWrite: boolean;
  canPay: boolean;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography>{value}</Typography>
    </Stack>
  );
}

export default function InvoiceDetail({
  invoice: initialInvoice,
  clientOptions,
  serviceOptions,
  itemOptions,
  canWrite,
  canPay,
}: Props) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [editLine, setEditLine] = useState<InvoiceLineItemDTO | null>(null);
  const [editInvoiceOpen, setEditInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [waBusy, setWaBusy] = useState(false);

  const isDraft = invoice.status === "Draft";
  const paid = Number(invoice.amountPaid) > 0;
  const balanceDue = Number(invoice.balance);

  const canIssue = canWrite && isDraft && invoice.lineItems.length > 0;
  const canVoid =
    canWrite &&
    !paid &&
    (invoice.status === "Draft" || invoice.status === "Issued");
  const canRecordPayment =
    canPay &&
    (invoice.status === "Issued" || invoice.status === "Partial") &&
    balanceDue > 0;

  function applyInvoice(next: InvoiceDTO) {
    setInvoice(next);
  }

  // Generate a clean, standalone invoice PDF and download it. The PDF renderer
  // is loaded on demand so it stays out of the initial page bundle.
  async function downloadPdf() {
    setPdfBusy(true);
    setError(null);
    try {
      const [{ pdf }, { default: InvoicePdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./InvoicePdfDocument"),
      ]);
      const blob = await pdf(<InvoicePdfDocument invoice={invoice} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  async function saveReceipt() {
    setError(null);
    try {
      await downloadReceiptImage(invoice);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the receipt",
      );
    }
  }

  async function sendWhatsApp() {
    setError(null);
    setSuccess(null);
    setWaBusy(true);
    try {
      await apiRequest(`/api/invoices/${invoice.invoiceId}/whatsapp`, {
        method: "POST",
      });
      setSuccess("Invoice PDF sent via WhatsApp.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send via WhatsApp",
      );
    } finally {
      setWaBusy(false);
    }
  }

  async function transition(status: "Issued" | "Void") {
    setBusy(true);
    setError(null);
    try {
      const data = await apiRequest<{ invoice: InvoiceDTO }>(
        `/api/invoices/${invoice.invoiceId}`,
        { method: "PATCH", body: { status } },
      );
      applyInvoice(data.invoice);
      setConfirmIssue(false);
      setConfirmVoid(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLine(lineItemId: number) {
    setError(null);
    try {
      const data = await apiRequest<{ invoice: InvoiceDTO }>(
        `/api/invoices/${invoice.invoiceId}/line-items/${lineItemId}`,
        { method: "DELETE" },
      );
      applyInvoice(data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove line");
    }
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography variant="h4">{invoice.number}</Typography>
            <Chip
              color={INVOICE_STATUS_COLOR[invoice.status]}
              label={invoice.status}
            />
            {invoice.isOverdue && <Chip color="error" label="Overdue" />}
          </Stack>
          <Typography color="text.secondary">
            Client:{" "}
            <Link href={`/clients/${invoice.clientId}`}>
              {invoice.clientName}
            </Link>
          </Typography>
          {invoice.issuedAt && (
            <Typography variant="body2" color="text.secondary">
              Issued {formatDateTime(invoice.issuedAt)}
            </Typography>
          )}
        </Box>

        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          sx={{ flexWrap: "wrap" }}
        >
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => void downloadPdf()}
            disabled={pdfBusy}
          >
            {pdfBusy ? "Preparing…" : "Download PDF"}
          </Button>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => printInvoiceReceipt(invoice)}
          >
            Print invoice
          </Button>
          <Button
            variant="outlined"
            startIcon={<ReceiptLongIcon />}
            onClick={() => void saveReceipt()}
          >
            Tiny Print
          </Button>
          <Button
            variant="outlined"
            color="success"
            startIcon={<WhatsAppIcon />}
            onClick={() => void sendWhatsApp()}
            disabled={waBusy}
          >
            {waBusy ? "Sending…" : "Send via WhatsApp"}
          </Button>
          {canWrite && isDraft && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditInvoiceOpen(true)}
            >
              Edit
            </Button>
          )}
          {canIssue && (
            <Button variant="contained" onClick={() => setConfirmIssue(true)}>
              Issue
            </Button>
          )}
          {canRecordPayment && (
            <Button
              variant="contained"
              color="success"
              startIcon={<PaymentsIcon />}
              onClick={() => setPaymentOpen(true)}
            >
              Record payment
            </Button>
          )}
          {canVoid && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<BlockIcon />}
              onClick={() => setConfirmVoid(true)}
            >
              Void
            </Button>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography variant="h6">Line items</Typography>
            {canWrite && isDraft && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddLineOpen(true)}
              >
                Add line
              </Button>
            )}
          </Stack>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Unit price</TableCell>
                  <TableCell align="right">Total</TableCell>
                  {canWrite && isDraft && <TableCell align="right" />}
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.lineItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canWrite && isDraft ? 5 : 4}
                      align="center"
                    >
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        No line items yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoice.lineItems.map((l) => (
                    <TableRow key={l.lineItemId} hover>
                      <TableCell>{l.description}</TableCell>
                      <TableCell align="right">{l.quantity}</TableCell>
                      <TableCell align="right">
                        {formatMoney(l.unitPrice)}
                      </TableCell>
                      <TableCell align="right">
                        {formatMoney(l.lineTotal)}
                      </TableCell>
                      {canWrite && isDraft && (
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            aria-label="Edit line"
                            onClick={() => setEditLine(l)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label="Remove line"
                            onClick={() => void deleteLine(l.lineItemId)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            Payments
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        No payments recorded.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoice.payments.map((p) => (
                    <TableRow key={p.paymentId} hover>
                      <TableCell>{formatDateTime(p.paidAt)}</TableCell>
                      <TableCell>{p.method ?? "-"}</TableCell>
                      <TableCell>{p.reference ?? "-"}</TableCell>
                      <TableCell align="right">
                        {formatMoney(p.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={1}>
              <Row label="Subtotal" value={formatMoney(invoice.subtotal)} />
              <Row
                label={`Discount (${invoice.discountPct}%)`}
                value={`-${formatMoney(
                  (Number(invoice.subtotal) * Number(invoice.discountPct)) /
                    100,
                )}`}
              />
              <Row
                label={`Tax (${invoice.taxPct}%)`}
                value={formatMoney(invoice.taxAmount)}
              />
              <Divider />
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="h6">Total</Typography>
                <Typography variant="h6">
                  {formatMoney(invoice.total)}
                </Typography>
              </Stack>
              <Row label="Paid" value={formatMoney(invoice.amountPaid)} />
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: "bold" }}>Balance</Typography>
                <Typography sx={{ fontWeight: "bold" }}>
                  {formatMoney(invoice.balance)}
                </Typography>
              </Stack>
              {invoice.dueDate && (
                <Row label="Due date" value={formatDate(invoice.dueDate)} />
              )}
              {invoice.notes && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body2">{invoice.notes}</Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <LineItemDialog
        open={addLineOpen}
        invoiceId={invoice.invoiceId}
        serviceOptions={serviceOptions}
        itemOptions={itemOptions}
        onClose={() => setAddLineOpen(false)}
        onSaved={applyInvoice}
      />
      <LineItemDialog
        open={Boolean(editLine)}
        invoiceId={invoice.invoiceId}
        serviceOptions={serviceOptions}
        itemOptions={itemOptions}
        line={editLine}
        onClose={() => setEditLine(null)}
        onSaved={applyInvoice}
      />
      <InvoiceFormDialog
        open={editInvoiceOpen}
        clientOptions={clientOptions}
        invoice={invoice}
        onClose={() => setEditInvoiceOpen(false)}
        onSaved={applyInvoice}
      />
      <PaymentDialog
        open={paymentOpen}
        invoiceId={invoice.invoiceId}
        balance={invoice.balance}
        onClose={() => setPaymentOpen(false)}
        onSaved={applyInvoice}
      />

      <Dialog open={confirmIssue} onClose={() => setConfirmIssue(false)}>
        <DialogTitle>Issue this invoice?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Issuing freezes the totals and line items. Any inventory lines will
            decrement stock. This cannot be undone except by voiding.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmIssue(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void transition("Issued")}
            disabled={busy}
          >
            {busy ? "Issuing…" : "Issue"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmVoid} onClose={() => setConfirmVoid(false)}>
        <DialogTitle>Void this invoice?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Voiding cancels the invoice. If it was issued, any sold stock is
            returned to inventory. Invoices with payments cannot be voided.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmVoid(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            color="error"
            onClick={() => void transition("Void")}
            disabled={busy}
          >
            {busy ? "Voiding…" : "Void"}
          </Button>
        </DialogActions>
      </Dialog>

      <Divider sx={{ mt: 4 }} />
    </Box>
  );
}
