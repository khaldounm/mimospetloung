"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { apiRequest } from "@/utils/api-client";
import { formatMoney } from "@/utils/format";
import type {
  PurchaseOrderDTO,
  ReturnableDeliveryLineDTO,
  ReturnableOrderDTO,
} from "@/types/entities";

interface Props {
  open: boolean;
  // The delivered order the goods came in on.
  orderId: number;
  onClose: () => void;
  // The RETURN document, which is a new order. The caller navigates to it.
  onCreated: (order: PurchaseOrderDTO) => void;
}

export default function SupplierReturnDialog({ open, ...rest }: Props) {
  return (
    <Dialog open={open} onClose={rest.onClose} fullWidth maxWidth="sm">
      {open && <SupplierReturnForm key={rest.orderId} {...rest} />}
    </Dialog>
  );
}

function SupplierReturnForm({
  orderId,
  onClose,
  onCreated,
}: Omit<Props, "open">) {
  const [source, setSource] = useState<ReturnableOrderDTO | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<{ order: ReturnableOrderDTO }>(
      `/api/orders/${orderId}/returnable`,
    )
      .then((r) => {
        if (!cancelled) setSource(r.order);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Could not load this order",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const chosen = source
    ? source.lines
        .map((line) => ({
          line,
          quantity: Number(quantities[line.lineId] ?? 0),
        }))
        .filter(({ quantity }) => quantity > 0)
    : [];

  const credit = chosen.reduce(
    (sum, { line, quantity }) => sum + quantity * Number(line.unitCost ?? 0),
    0,
  );

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const r = await apiRequest<{ order: PurchaseOrderDTO }>(
        `/api/orders/${orderId}/returns`,
        {
          method: "POST",
          body: {
            entries: chosen.map(({ line, quantity }) => ({
              sourceLineId: line.lineId,
              quantity,
            })),
          },
        },
      );
      onCreated(r.order);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not raise the return");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogTitle>Return to supplier</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="body2" color="text.secondary">
            This raises a separate return document, leaving this order as the
            supplier invoiced it. Nothing leaves the shelf until the return
            itself is received, which is when the goods actually go back.
          </Typography>

          {source && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Delivered</TableCell>
                    <TableCell align="right">Can go back</TableCell>
                    <TableCell align="right" sx={{ width: 110 }}>
                      Returning
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {source.lines.map((line) => (
                    <Row
                      key={line.lineId}
                      line={line}
                      value={quantities[line.lineId] ?? ""}
                      onChange={(v) =>
                        setQuantities((q) => ({ ...q, [line.lineId]: v }))
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {chosen.length > 0 && (
            <Alert severity="info">
              Taking {formatMoney(credit.toFixed(2))} off what is owed to{" "}
              {source?.supplierName ?? "this supplier"}, once the return is
              sent.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={() => void submit()}
          disabled={saving || chosen.length === 0}
        >
          {saving ? "Raising…" : "Raise return"}
        </Button>
      </DialogActions>
    </>
  );
}

function Row({
  line,
  value,
  onChange,
}: {
  line: ReturnableDeliveryLineDTO;
  value: string;
  onChange: (v: string) => void;
}) {
  const returnable = Number(line.quantityReturnable);
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2">{line.itemName}</Typography>
        {Number(line.quantityReturned) > 0 && (
          <Typography variant="caption" color="text.secondary">
            {line.quantityReturned} already going back
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">{line.quantityReceived}</TableCell>
      <TableCell align="right">{line.quantityReturnable}</TableCell>
      <TableCell align="right">
        <TextField
          size="small"
          type="number"
          value={value}
          disabled={returnable <= 0}
          onChange={(e) => onChange(e.target.value)}
          slotProps={{ htmlInput: { min: 0, max: returnable, step: "0.001" } }}
          sx={{ width: 90 }}
        />
      </TableCell>
    </TableRow>
  );
}
