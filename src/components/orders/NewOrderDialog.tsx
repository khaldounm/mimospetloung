"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { INVENTORY_CATEGORIES } from "@/constants/inventory";
import {
  NO_SUPPLIER_LABEL,
  UNCATEGORISED_ORDER_LABEL,
} from "@/constants/order";
import type { PurchaseOrderDTO, SupplierDTO } from "@/types/entities";

interface Props {
  open: boolean;
  suppliers: SupplierDTO[];
  onClose: () => void;
}

// Starts an empty order by hand, for a buy the low-stock basket cannot express:
// a one-off, or stock the catalogue does not have an item for yet. Everything
// here is optional and editable afterwards, so the dialog is a way in rather
// than a form to be completed: the order opens straight away and the lines get
// added on the order page.
export default function NewOrderDialog({ open, suppliers, onClose }: Props) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await apiRequest<{ order: PurchaseOrderDTO }>("/api/orders", {
        method: "POST",
        body: {
          supplierId: supplierId || null,
          category: category || null,
          reference,
        },
      });
      // Straight into the new order: an empty sheet is only useful once lines
      // are on it, and that is the next thing anyone will do.
      router.push(`/orders/${res.order.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Start an order</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Opens an empty draft. Add the items on the next screen, including
            anything the catalogue does not stock yet.
          </DialogContentText>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              helperText="Can be set later, but an order cannot be placed without one"
            >
              <MenuItem value="">{NO_SUPPLIER_LABEL}</MenuItem>
              {suppliers.map((s) => (
                <MenuItem key={s.supplierId} value={String(s.supplierId)}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              helperText="Which product line this sheet covers, so it reaches the right rep"
            >
              <MenuItem value="">{UNCATEGORISED_ORDER_LABEL}</MenuItem>
              {INVENTORY_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Their reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Supplier's order or invoice number"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? "Creating…" : "Create order"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
