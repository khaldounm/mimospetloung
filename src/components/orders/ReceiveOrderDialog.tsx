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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { toDateOnly } from "@/utils/format";
import type { PurchaseOrderDTO, PurchaseOrderLineDTO } from "@/types/entities";

interface Props {
  open: boolean;
  order: PurchaseOrderDTO;
  onClose: () => void;
  onReceived: (order: PurchaseOrderDTO) => void;
}

export default function ReceiveOrderDialog({ open, onClose, ...rest }: Props) {
  // Remount per open so the quantities re-seed from what is currently
  // outstanding rather than from a previous delivery.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      {open && <ReceiveForm onClose={onClose} {...rest} />}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function ReceiveForm({ order, onClose, onReceived }: FormProps) {
  // Only lines with something still expected can take a delivery.
  const outstanding = (order.lines ?? []).filter(
    (l) => Number(l.quantityOutstanding) > 0,
  );

  const [quantities, setQuantities] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      outstanding.map((l) => [l.lineId, l.quantityOutstanding]),
    ),
  );
  const [receivedOn, setReceivedOn] = useState(
    () => toDateOnly(new Date()) ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const entered = outstanding.filter((l) => Number(quantities[l.lineId]) > 0);
  const short = entered.some(
    (l) => Number(quantities[l.lineId]) < Number(l.quantityOutstanding),
  );
  const partial = short || entered.length < outstanding.length;

  function missingCost(line: PurchaseOrderLineDTO) {
    return line.unitCost == null && Number(quantities[line.lineId]) > 0;
  }
  const anyMissingCost = outstanding.some(missingCost);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lines = outstanding
      .map((l) => ({
        lineId: l.lineId,
        quantity: Number(quantities[l.lineId]),
      }))
      .filter((l) => Number.isFinite(l.quantity) && l.quantity > 0);

    if (lines.length === 0) {
      setError("Enter a quantity for at least one line.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiRequest<{ order: PurchaseOrderDTO }>(
        `/api/orders/${order.orderId}/receive`,
        { method: "POST", body: { lines, receivedOn } },
      );
      onReceived(res.order);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to receive");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>Receive delivery</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Enter what actually turned up. Anything left short stays outstanding,
          and you can receive against this order again when the rest arrives.
        </DialogContentText>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {anyMissingCost && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Some lines have no unit cost. Set one on the order first: it becomes
            the item&apos;s cost price and is what the profit report charges
            when that stock sells.
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            label="Delivery date"
            type="date"
            size="small"
            value={receivedOn}
            onChange={(e) => setReceivedOn(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 200 }}
          />

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell align="right">Ordered</TableCell>
                <TableCell align="right">Already in</TableCell>
                <TableCell align="right">Outstanding</TableCell>
                <TableCell align="right">Receiving now</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outstanding.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      Everything on this order has already been received.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                outstanding.map((l) => (
                  <TableRow key={l.lineId}>
                    <TableCell>
                      {l.itemName}
                      {l.unit && (
                        <Typography variant="caption" color="text.secondary">
                          {` (${l.unit})`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{l.quantityOrdered}</TableCell>
                    <TableCell align="right">{l.quantityReceived}</TableCell>
                    <TableCell align="right">{l.quantityOutstanding}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        value={quantities[l.lineId] ?? ""}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [l.lineId]: e.target.value,
                          }))
                        }
                        error={missingCost(l)}
                        slotProps={{
                          htmlInput: {
                            min: 0,
                            max: Number(l.quantityOutstanding),
                            step: "0.01",
                          },
                        }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {partial && entered.length > 0 && (
            <Alert severity="info">
              This is a part delivery. The order stays open at Partial with the
              shortfall still outstanding.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={saving || outstanding.length === 0 || anyMissingCost}
        >
          {saving ? "Receiving…" : "Receive"}
        </Button>
      </DialogActions>
    </form>
  );
}
