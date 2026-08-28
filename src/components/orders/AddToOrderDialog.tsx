"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
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
import { suggestedReorderQuantity } from "@/utils/inventory";
import {
  NO_SUPPLIER_LABEL,
  UNCATEGORISED_ORDER_LABEL,
} from "@/constants/order";
import type { InventoryItemDTO } from "@/types/entities";

interface FutureOrderResult {
  orderId: number;
  supplierId: number | null;
  supplierName: string | null;
  category: string | null;
  itemsAdded: number;
}

interface Props {
  open: boolean;
  items: InventoryItemDTO[];
  onClose: () => void;
  onAdded: (results: FutureOrderResult[]) => void;
}

export default function AddToOrderDialog({ open, onClose, ...rest }: Props) {
  // Remount per selection so the quantity inputs re-seed from the picked items.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      {open && (
        <AddToOrderForm
          key={rest.items.map((i) => i.itemId).join("-")}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function AddToOrderForm({ items, onClose, onAdded }: FormProps) {
  const [quantities, setQuantities] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      items.map((i) => [i.itemId, String(suggestedReorderQuantity(i))]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Preview of the routing the server will do, so it is obvious up front which
  // items land where and which have no supplier to land with. Grouped by
  // supplier AND shelf, matching draftBucketKey on the server: the two have to
  // agree or the dialog promises a layout the save does not produce.
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        supplierLabel: string;
        category: string | null;
        needsSupplier: boolean;
        items: InventoryItemDTO[];
      }
    >();
    for (const item of items) {
      const category = item.category?.trim() ? item.category : null;
      const key = `${item.supplierId ?? "none"}::${category ?? "none"}`;
      const group = map.get(key);
      if (group) group.items.push(item);
      else {
        map.set(key, {
          supplierLabel: item.supplierName ?? NO_SUPPLIER_LABEL,
          category,
          needsSupplier: item.supplierId == null,
          items: [item],
        });
      }
    }
    return [...map.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort(
        (a, b) =>
          // Everything that still needs a supplier floats to the top, since it
          // is the only thing here that blocks placing an order.
          Number(b.needsSupplier) - Number(a.needsSupplier) ||
          a.supplierLabel.localeCompare(b.supplierLabel) ||
          (a.category ?? "").localeCompare(b.category ?? ""),
      );
  }, [items]);

  const unassigned = items.filter((i) => i.supplierId == null).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lines = items
      .map((i) => ({
        itemId: i.itemId,
        quantity: Number(quantities[i.itemId]),
      }))
      .filter((l) => Number.isFinite(l.quantity) && l.quantity > 0);

    if (lines.length === 0) {
      setError("Give at least one item a quantity above zero.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiRequest<{ orders: FutureOrderResult[] }>(
        "/api/orders/add-items",
        { method: "POST", body: { lines } },
      );
      onAdded(res.orders);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>Add to future order</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Each item joins the open draft for its supplier and its shelf, or
          starts one, so food and medication from the same company stay on
          separate sheets for the rep who handles them. Adding an item already
          on that draft increases its quantity.
        </DialogContentText>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {unassigned > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {unassigned} item(s) have no usual supplier. They collect in the
            &quot;{NO_SUPPLIER_LABEL}&quot; order, which cannot be placed until
            you pick one.
          </Alert>
        )}

        <Stack spacing={3}>
          {groups.map((group) => (
            <div key={group.key}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", mb: 1 }}
              >
                <Typography sx={{ fontWeight: 600 }}>
                  {group.supplierLabel}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={group.category ?? UNCATEGORISED_ORDER_LABEL}
                />
                {group.needsSupplier && (
                  <Chip size="small" color="warning" label="Needs a supplier" />
                )}
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">In stock</TableCell>
                    <TableCell align="right">Reorder at</TableCell>
                    <TableCell align="right">Order quantity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.items.map((i) => (
                    <TableRow key={i.itemId}>
                      <TableCell>
                        {i.name}
                        {i.unit && (
                          <Typography variant="caption" color="text.secondary">
                            {` (${i.unit})`}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{i.currentStock}</TableCell>
                      <TableCell align="right">{i.reorderLevel}</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={quantities[i.itemId] ?? ""}
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [i.itemId]: e.target.value,
                            }))
                          }
                          slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                          sx={{ width: 120 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? "Adding…" : "Add to order"}
        </Button>
      </DialogActions>
    </form>
  );
}
