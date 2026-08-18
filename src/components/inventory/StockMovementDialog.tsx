"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import { INVENTORY_TX_TYPES, type InventoryTxType } from "@/types/enums";

interface Props {
  open: boolean;
  itemId: number;
  itemName: string;
  unit: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const HELP: Record<InventoryTxType, string> = {
  Received: "Adds stock. Unit cost updates the item's last cost.",
  Used: "Removes stock (e.g. used in a procedure).",
  Sold: "Removes stock sold to a client.",
  Adjusted: "Correction. Use a negative number to reduce stock.",
  Expired: "Removes stock that has expired or was discarded.",
};

export default function StockMovementDialog({ open, onClose, ...rest }: Props) {
  // Remount the form (via key) each time the dialog opens instead of resetting
  // state with an effect. State starts from its defaults on mount.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      {open && (
        <StockMovementForm key={rest.itemId} onClose={onClose} {...rest} />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function StockMovementForm({
  itemId,
  itemName,
  unit,
  onClose,
  onSaved,
}: FormProps) {
  const [type, setType] = useState<InventoryTxType>("Received");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isReceived = type === "Received";
  const isAdjusted = type === "Adjusted";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiRequest(`/api/inventory/${itemId}/transactions`, {
        method: "POST",
        body: {
          type,
          quantity,
          unitCost: isReceived ? unitCost : "",
          notes,
        },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record movement",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>Record stock movement</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Item"
            value={itemName}
            slotProps={{ input: { readOnly: true } }}
            fullWidth
          />
          <TextField
            select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as InventoryTxType)}
            helperText={HELP[type]}
            fullWidth
          >
            {INVENTORY_TX_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={`Quantity${unit ? ` (${unit})` : ""}`}
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            slotProps={{
              htmlInput: isAdjusted
                ? { step: "0.01" }
                : { min: 0.01, step: "0.01" },
            }}
            required
            fullWidth
          />
          {isReceived && (
            <TextField
              label="Unit cost"
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              required
              fullWidth
            />
          )}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? "Saving…" : "Record"}
        </Button>
      </DialogActions>
    </form>
  );
}
