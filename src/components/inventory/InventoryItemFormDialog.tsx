"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import QrCode2Icon from "@mui/icons-material/QrCode2";
// import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { apiRequest } from "@/utils/api-client";
import { INVENTORY_CATEGORIES } from "@/constants/inventory";
import { isValidEan13 } from "@/utils/barcode";
// import { downloadBarcodeLabelImage } from "@/utils/barcode-label";
import type {
  InventoryItemDTO,
  PartnerDTO,
  SupplierDTO,
} from "@/types/entities";
import SupplierFormDialog from "@/components/suppliers/SupplierFormDialog";
import BarcodeLabelDialog from "./BarcodeLabelDialog";

// Sentinel option that opens the inline "new supplier" dialog instead of
// selecting a value, so a missing supplier can be added without leaving the form.
const ADD_SUPPLIER = "__add__";

interface Props {
  open: boolean;
  item?: InventoryItemDTO | null;
  canViewSuppliers: boolean;
  canCreateSuppliers: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function InventoryItemFormDialog({
  open,
  onClose,
  ...rest
}: Props) {
  // Remount the form (via key) each time the dialog opens instead of syncing
  // props into state with an effect. State is initialized directly from props.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <InventoryItemForm
          key={rest.item?.itemId ?? "new"}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function InventoryItemForm({
  item,
  canViewSuppliers,
  canCreateSuppliers,
  onClose,
  onSaved,
}: FormProps) {
  const editing = Boolean(item);
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [barcode, setBarcode] = useState(item?.barcode ?? "");
  const [reorderLevel, setReorderLevel] = useState(
    item ? String(item.reorderLevel) : "0",
  );
  const [openingStock, setOpeningStock] = useState("");
  const [salePrice, setSalePrice] = useState(item?.salePrice ?? "");
  const [lastCost, setLastCost] = useState(item?.lastCost ?? "");
  const [partnerId, setPartnerId] = useState(
    item?.partnerId != null ? String(item.partnerId) : "",
  );
  const [partnerSharePct, setPartnerSharePct] = useState(
    item?.partnerSharePct ?? "",
  );
  // Whether the share was typed by hand. An existing per-item override counts as
  // hand-set so editing the item does not silently overwrite it. Until touched,
  // the share tracks the picked partner's default.
  const [shareTouched, setShareTouched] = useState(
    item?.partnerSharePct != null && item.partnerSharePct !== "",
  );
  const [partners, setPartners] = useState<PartnerDTO[]>([]);
  const [supplierId, setSupplierId] = useState(
    item?.supplierId != null ? String(item.supplierId) : "",
  );
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [expiryDate, setExpiryDate] = useState(item?.expiryDate ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  // Load active partners for the "sourced from" picker (consignment stock).
  useEffect(() => {
    let alive = true;
    apiRequest<{ partners: PartnerDTO[] }>("/api/partners?active=1")
      .then((data) => {
        if (alive) setPartners(data.partners);
      })
      .catch(() => {
        // Non-fatal: the picker just stays empty if partners cannot load.
      });
    return () => {
      alive = false;
    };
  }, []);

  // Load active suppliers for the "usual supplier" picker. Skipped entirely for
  // staff without purchasing access, who never see the field.
  useEffect(() => {
    if (!canViewSuppliers) return;
    let alive = true;
    apiRequest<{ suppliers: SupplierDTO[] }>("/api/suppliers?active=1")
      .then((data) => {
        if (alive) setSuppliers(data.suppliers);
      })
      .catch(() => {
        // Non-fatal: the picker just stays empty if suppliers cannot load.
      });
    return () => {
      alive = false;
    };
  }, [canViewSuppliers]);

  // Picking the sentinel opens the inline create dialog and leaves the current
  // selection alone, so cancelling out does not clear an existing supplier.
  function handleSupplierChange(value: string) {
    if (value === ADD_SUPPLIER) {
      setSupplierDialogOpen(true);
      return;
    }
    setSupplierId(value);
  }

  function handleSupplierCreated(supplier: SupplierDTO) {
    setSuppliers((prev) =>
      [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setSupplierId(String(supplier.supplierId));
  }

  // Track the picked partner's default share until the user overrides it, so
  // switching partners follows the newly-picked default (rather than keeping the
  // previous partner's). Clearing the partner resets the share and the override.
  function handlePartnerChange(value: string) {
    setPartnerId(value);
    if (!value) {
      setPartnerSharePct("");
      setShareTouched(false);
      return;
    }
    if (!shareTouched) {
      const picked = partners.find((p) => String(p.partnerId) === value);
      setPartnerSharePct(picked ? picked.defaultSharePct : "");
    }
  }

  async function generateBarcode() {
    setGenerating(true);
    setError(null);
    try {
      const { barcode: next } = await apiRequest<{ barcode: string }>(
        "/api/inventory/next-barcode",
      );
      setBarcode(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate barcode",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        name,
        category,
        unit,
        barcode,
        reorderLevel,
        salePrice,
        lastCost,
        partnerId,
        partnerSharePct,
        // Omitted entirely for staff without purchasing access, so saving the
        // form never clears a supplier they were not shown.
        ...(canViewSuppliers ? { supplierId } : {}),
        expiryDate,
        notes,
        // Opening stock only seeds a new item; edits move stock via movements.
        ...(editing ? {} : { openingStock }),
      };
      if (editing) {
        await apiRequest(`/api/inventory/${item!.itemId}`, {
          method: "PATCH",
          body,
        });
      } else {
        await apiRequest("/api/inventory", { method: "POST", body });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    // The supplier dialog carries its own <form>, so it is rendered as a
    // sibling: nesting it would let its submit bubble up and save the item too.
    <>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{editing ? "Edit item" : "New item"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                fullWidth
              >
                <MenuItem value="">None</MenuItem>
                {INVENTORY_CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. box, vial, kg"
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Generate a unique internal barcode">
                          <span>
                            <IconButton
                              size="small"
                              edge="end"
                              onClick={() => void generateBarcode()}
                              disabled={generating}
                            >
                              <AutoFixHighIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="Reorder level"
                type="number"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                fullWidth
              />
            </Stack>
            {!editing && (
              <TextField
                label="Opening stock"
                type="number"
                value={openingStock}
                onChange={(e) => setOpeningStock(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                helperText="Quantity on hand now (optional). Records a stock receipt at the cost above."
                fullWidth
              />
            )}
            <Stack direction="row" spacing={2}>
              <TextField
                label="Sale price"
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                fullWidth
              />
              <TextField
                label="Last cost"
                type="number"
                value={lastCost}
                onChange={(e) => setLastCost(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                helperText="Auto-updated when stock is received"
                fullWidth
              />
            </Stack>
            {canViewSuppliers && (
              <TextField
                select
                label="Usual supplier"
                value={supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                helperText="Optional. Groups this item when reordering."
                fullWidth
              >
                <MenuItem value="">Not assigned</MenuItem>
                {suppliers.map((s) => (
                  <MenuItem key={s.supplierId} value={String(s.supplierId)}>
                    {s.name}
                  </MenuItem>
                ))}
                {canCreateSuppliers && (
                  <MenuItem value={ADD_SUPPLIER}>+ Add new supplier…</MenuItem>
                )}
              </TextField>
            )}
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Sourced from partner"
                value={partnerId}
                onChange={(e) => handlePartnerChange(e.target.value)}
                helperText="Optional. Consignment stock a partner funded."
                fullWidth
              >
                <MenuItem value="">None (clinic-owned)</MenuItem>
                {partners.map((p) => (
                  <MenuItem key={p.partnerId} value={String(p.partnerId)}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Profit share"
                type="number"
                value={partnerSharePct}
                onChange={(e) => {
                  setPartnerSharePct(e.target.value);
                  setShareTouched(true);
                }}
                disabled={!partnerId}
                slotProps={{
                  htmlInput: { min: 0, max: 100, step: "0.01" },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">%</InputAdornment>
                    ),
                  },
                }}
                helperText={
                  partnerId
                    ? "Overrides the partner default"
                    : "Pick a partner first"
                }
                fullWidth
              />
            </Stack>
            {partnerId && (
              <Alert severity="info" sx={{ py: 0 }}>
                On sale, this partner is owed their cost back plus the share of
                profit above. Set a Last cost so the split is accurate.
              </Alert>
            )}
            <TextField
              label="Expiry date"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
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
          <Tooltip
            title={
              isValidEan13(barcode)
                ? "Print a barcode label"
                : "Generate a barcode first"
            }
          >
            <span>
              <Button
                type="button"
                startIcon={<QrCode2Icon />}
                onClick={() => setLabelOpen(true)}
                disabled={!isValidEan13(barcode)}
              >
                Print label
              </Button>
            </span>
          </Tooltip>
          {/* <Tooltip
          title={
            isValidEan13(barcode)
              ? "Download the label image for the Tiny Print app"
              : "Generate a barcode first"
          }
        >
          <span>
            <Button
              type="button"
              startIcon={<ReceiptLongIcon />}
              onClick={() => void downloadBarcodeLabelImage(barcode, name)}
              disabled={!isValidEan13(barcode)}
              sx={{ mr: "auto" }}
            >
              Tiny Print
            </Button>
          </span>
        </Tooltip> */}
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>

        <BarcodeLabelDialog
          open={labelOpen}
          barcode={barcode}
          name={name}
          onClose={() => setLabelOpen(false)}
        />
      </form>

      <SupplierFormDialog
        open={supplierDialogOpen}
        onClose={() => setSupplierDialogOpen(false)}
        onSaved={handleSupplierCreated}
      />
    </>
  );
}
