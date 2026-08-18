"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import PaymentsIcon from "@mui/icons-material/Payments";
import DeleteIcon from "@mui/icons-material/Delete";
import { apiRequest } from "@/utils/api-client";
import { formatDate, formatMoney } from "@/utils/format";
import { ORDER_STATUS_COLOR } from "@/constants/order";
import StatCard from "@/components/ui/StatCard";
import type {
  PurchaseOrderDTO,
  SupplierDTO,
  SupplierPaymentDTO,
} from "@/types/entities";
import SupplierFormDialog from "./SupplierFormDialog";
import SupplierPaymentFormDialog from "./SupplierPaymentFormDialog";

interface Props {
  supplier: SupplierDTO;
  orders: PurchaseOrderDTO[];
  payments: SupplierPaymentDTO[];
  payableOrders: PurchaseOrderDTO[];
  canWrite: boolean;
}

export default function SupplierDetail({
  supplier,
  orders,
  payments,
  payableOrders,
  canWrite,
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read straight from props rather than seeding state from them. Copying a prop
  // into useState freezes it at first mount, so router.refresh() would bring
  // fresh figures down and the cards would keep showing the old ones.
  const money = supplier.money;
  const balance = Number(money?.balance ?? 0);
  const inCredit = balance < 0;

  async function deletePayment(payment: SupplierPaymentDTO) {
    if (!window.confirm(`Delete the ${formatMoney(payment.amount)} payment?`)) {
      return;
    }
    setError(null);
    try {
      await apiRequest(
        `/api/suppliers/${supplier.supplierId}/payments/${payment.paymentId}`,
        { method: "DELETE" },
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography variant="h4">{supplier.name}</Typography>
            {!supplier.isActive && <Chip label="Inactive" />}
          </Stack>
          <Typography color="text.secondary">
            {[supplier.contactPerson, supplier.phone, supplier.email]
              .filter(Boolean)
              .join(" · ") || "No contact details"}
          </Typography>
        </Box>
        {canWrite && (
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<PaymentsIcon />}
              onClick={() => setPayOpen(true)}
            >
              Record payment
            </Button>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
          </Stack>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          mb: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(4, 1fr)",
          },
        }}
      >
        <StatCard
          label="Billed"
          value={formatMoney(money?.invoiced)}
          hint={`${money?.orderCount ?? 0} delivered order(s)`}
        />
        <StatCard label="Paid" value={formatMoney(money?.paid)} />
        {/* A negative balance is money paid with no bill to match it, which is a
            credit rather than a debt. Shown as such and flagged, not coloured
            green: unmatched cash needs looking at, it is not "settled". */}
        <StatCard
          label={inCredit ? "In credit" : "Owed now"}
          value={formatMoney(Math.abs(balance))}
          accent={inCredit ? "info" : balance > 0 ? "warning" : "success"}
          hint={
            inCredit ? "Paid more than has been billed" : "Billed minus paid"
          }
        />
        <StatCard
          label="In progress"
          value={formatMoney(money?.inProgress)}
          hint={`${money?.openOrderCount ?? 0} order(s) not yet delivered`}
        />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        An order counts as billed once it is Received, meaning fully delivered
        or closed short. Orders still in draft, placed or part-delivered show
        under In progress and are not owed yet.
      </Typography>

      <Typography variant="h5" sx={{ mb: 2 }}>
        Orders
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Placed</TableCell>
              <TableCell>Received</TableCell>
              <TableCell align="right">Items</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No orders with this supplier yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.orderId} hover>
                  <TableCell>
                    <Link href={`/orders/${o.orderId}`}>
                      {o.reference || `Order #${o.orderId}`}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={ORDER_STATUS_COLOR[o.status]}
                      label={o.status}
                    />
                  </TableCell>
                  <TableCell>
                    {o.orderedOn ? formatDate(o.orderedOn) : "-"}
                  </TableCell>
                  <TableCell>
                    {o.receivedOn ? formatDate(o.receivedOn) : "-"}
                  </TableCell>
                  <TableCell align="right">{o.lineCount}</TableCell>
                  <TableCell align="right">{formatMoney(o.total)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h5" sx={{ mb: 2 }}>
        Payments
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Against</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Added by</TableCell>
              {canWrite && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 7 : 6} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No payments recorded yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow key={p.paymentId} hover>
                  <TableCell>{formatDate(p.paidOn)}</TableCell>
                  <TableCell align="right">{formatMoney(p.amount)}</TableCell>
                  <TableCell>
                    {p.orderId ? (
                      <Link href={`/orders/${p.orderId}`}>
                        {p.orderReference}
                      </Link>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        The account
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{p.method ?? "-"}</TableCell>
                  <TableCell>{p.reference ?? "-"}</TableCell>
                  <TableCell>{p.createdByName ?? "-"}</TableCell>
                  {canWrite && (
                    <TableCell align="right">
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => void deletePayment(p)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <SupplierFormDialog
        open={editOpen}
        supplier={supplier}
        onClose={() => setEditOpen(false)}
        onSaved={() => router.refresh()}
      />
      <SupplierPaymentFormDialog
        open={payOpen}
        supplierId={supplier.supplierId}
        supplierName={supplier.name}
        balance={money?.balance ?? "0"}
        payableOrders={payableOrders}
        onClose={() => setPayOpen(false)}
        onSaved={() => router.refresh()}
      />
    </Box>
  );
}
