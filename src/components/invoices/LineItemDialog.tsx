"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { apiRequest } from "@/utils/api-client";
import type { InvoiceDTO, InvoiceLineItemDTO } from "@/types/entities";

export interface ServiceLineOption {
  serviceId: number;
  name: string;
  price: string;
}

export interface ItemLineOption {
  itemId: number;
  name: string;
  barcode: string | null;
  salePrice: string | null;
  currentStock: number;
  unit: string | null;
}

interface Props {
  open: boolean;
  invoiceId: number;
  serviceOptions: ServiceLineOption[];
  itemOptions: ItemLineOption[];
  // When provided, the dialog edits this line instead of adding a new one.
  line?: InvoiceLineItemDTO | null;
  onClose: () => void;
  onSaved: (invoice: InvoiceDTO) => void;
}

type SourceType = "service" | "item";

export default function LineItemDialog({ open, onClose, ...rest }: Props) {
  // Remount the form (via key) each time the dialog opens instead of syncing
  // props into state with an effect. State is initialized directly from props.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <LineItemForm
          key={rest.line?.lineItemId ?? "new"}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function LineItemForm({
  invoiceId,
  serviceOptions,
  itemOptions,
  line,
  onClose,
  onSaved,
}: FormProps) {
  const editing = Boolean(line);
  const [sourceType, setSourceType] = useState<SourceType>(
    line?.itemId != null ? "item" : "service",
  );
  const [sourceId, setSourceId] = useState(
    line?.itemId != null
      ? String(line.itemId)
      : line?.serviceId != null
        ? String(line.serviceId)
        : "",
  );
  const [description, setDescription] = useState(line?.description ?? "");
  const [quantity, setQuantity] = useState(line?.quantity ?? "1");
  const [unitPrice, setUnitPrice] = useState(line?.unitPrice ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Raw text from the barcode scanner (or manual entry) before it resolves to
  // an item. Scanners type the code then send Enter, so we resolve on Enter.
  const [barcode, setBarcode] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);

  // When editing, the source (service/item) is fixed; only qty/price/desc change.
  const isItem = editing ? line!.itemId != null : sourceType === "item";

  // Prefill description + unit price when a source is picked.
  function pickSource(id: string) {
    setSourceId(id);
    if (!id) return;
    if (isItem) {
      const item = itemOptions.find((o) => String(o.itemId) === id);
      if (item) {
        setDescription(item.name);
        setUnitPrice(item.salePrice ?? "");
      }
    } else {
      const svc = serviceOptions.find((o) => String(o.serviceId) === id);
      if (svc) {
        setDescription(svc.name);
        setUnitPrice(svc.price);
      }
    }
  }

  // Resolve a scanned/typed barcode to an inventory item. Lookup is local
  // against the already-loaded options, keyed on the item's unique barcode.
  function scanBarcode(code: string) {
    const trimmed = code.trim();
    setScanError(null);
    if (!trimmed) return;
    const item = itemOptions.find(
      (o) => o.barcode != null && o.barcode === trimmed,
    );
    if (!item) {
      setScanError(`No inventory item matches barcode "${trimmed}".`);
      return;
    }
    pickSource(String(item.itemId));
    setBarcode("");
  }

  function clearScannedItem() {
    setSourceId("");
    setDescription("");
    setUnitPrice("");
    setBarcode("");
    setScanError(null);
  }

  function changeType(next: SourceType | null) {
    if (!next) return;
    setSourceType(next);
    setSourceId("");
    setDescription("");
    setUnitPrice("");
    setBarcode("");
    setScanError(null);
  }

  const selectedItem = useMemo(
    () =>
      isItem
        ? itemOptions.find((o) => String(o.itemId) === sourceId)
        : undefined,
    [isItem, itemOptions, sourceId],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!editing && isItem && !sourceId) {
      setError("Scan a barcode or search to select an inventory item.");
      return;
    }
    setSaving(true);
    try {
      let data: { invoice: InvoiceDTO };
      if (editing) {
        data = await apiRequest<{ invoice: InvoiceDTO }>(
          `/api/invoices/${invoiceId}/line-items/${line!.lineItemId}`,
          { method: "PATCH", body: { description, quantity, unitPrice } },
        );
      } else {
        data = await apiRequest<{ invoice: InvoiceDTO }>(
          `/api/invoices/${invoiceId}/line-items`,
          {
            method: "POST",
            body: {
              serviceId: isItem ? "" : sourceId,
              itemId: isItem ? sourceId : "",
              description,
              quantity,
              unitPrice,
            },
          },
        );
      }
      onSaved(data.invoice);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save line");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>{editing ? "Edit line item" : "Add line item"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {!editing && (
            <>
              <ToggleButtonGroup
                value={sourceType}
                exclusive
                onChange={(_e, v) => changeType(v as SourceType | null)}
                size="small"
              >
                <ToggleButton value="service">Service</ToggleButton>
                <ToggleButton value="item">Inventory item</ToggleButton>
              </ToggleButtonGroup>

              {isItem ? (
                selectedItem ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Chip
                      color="primary"
                      variant="outlined"
                      label={`${selectedItem.name} (${selectedItem.currentStock}${
                        selectedItem.unit ? ` ${selectedItem.unit}` : ""
                      } in stock)`}
                    />
                    <IconButton
                      size="small"
                      aria-label="Scan a different item"
                      onClick={clearScannedItem}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ) : (
                  <Stack spacing={2}>
                    <TextField
                      label="Scan barcode"
                      value={barcode}
                      onChange={(e) => {
                        setBarcode(e.target.value);
                        if (scanError) setScanError(null);
                      }}
                      onKeyDown={(e) => {
                        // Barcode scanners append Enter; resolve here and keep
                        // the keystroke from submitting the form.
                        if (e.key === "Enter") {
                          e.preventDefault();
                          scanBarcode(barcode);
                        }
                      }}
                      error={Boolean(scanError)}
                      helperText={
                        scanError ??
                        "Scan or type a barcode, then press Enter. Stock is decremented when the invoice is issued."
                      }
                      autoFocus
                      fullWidth
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <QrCodeScannerIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                    {/* Searchable picker for items that can't be scanned at the
                        counter (e.g. anaesthesia, gloves). */}
                    <Autocomplete
                      options={itemOptions}
                      getOptionLabel={(o) =>
                        `${o.name}${
                          o.barcode ? "" : " (no barcode)"
                        } - ${o.currentStock}${o.unit ? ` ${o.unit}` : ""} in stock`
                      }
                      isOptionEqualToValue={(o, v) => o.itemId === v.itemId}
                      value={null}
                      blurOnSelect
                      onChange={(_e, v) => {
                        if (v) pickSource(String(v.itemId));
                      }}
                      renderInput={(p) => (
                        <TextField
                          {...p}
                          label="Or search the item list"
                          helperText="Pick items that aren't scannable at the counter"
                        />
                      )}
                    />
                  </Stack>
                )
              ) : (
                <TextField
                  select
                  label="Service"
                  value={sourceId}
                  onChange={(e) => pickSource(e.target.value)}
                  required
                  fullWidth
                >
                  {serviceOptions.map((o) => (
                    <MenuItem key={o.serviceId} value={String(o.serviceId)}>
                      {o.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </>
          )}

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              slotProps={{
                htmlInput: { min: 0.01, step: "0.01" },
              }}
              required
              fullWidth
              helperText={
                isItem && selectedItem
                  ? `Max sellable now: ${selectedItem.currentStock}`
                  : undefined
              }
            />
            <TextField
              label="Unit price"
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              required
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </form>
  );
}
