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
  FormControlLabel,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { apiRequest } from "@/utils/api-client";
import { CLINIC_USE_COST_CATEGORY } from "@/constants/running-cost";
import { toGtin14 } from "@/utils/barcode";
import { looseConfigOf, looseLine, minLooseQuantity } from "@/utils/inventory";
import type { InvoiceDTO } from "@/types/entities";

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
  // Present only on items set up to be sold loose. Null on everything else,
  // which is what hides the loose controls for the rest of the catalogue.
  looseUnit: string | null;
  loosePerUnit: string | null;
  loosePrice: string | null;
}

interface Props {
  open: boolean;
  invoiceId: number;
  serviceOptions: ServiceLineOption[];
  itemOptions: ItemLineOption[];
  onClose: () => void;
  onSaved: (invoice: InvoiceDTO) => void;
}

type SourceType = "service" | "item";

// Adding a line only. Changing one is done in the row itself, on the invoice,
// so a correction at the counter never costs a dialog.
export default function LineItemDialog({ open, onClose, ...rest }: Props) {
  // The form mounts fresh each time the dialog opens instead of syncing props
  // into state with an effect. State is initialized directly from props.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && <LineItemForm onClose={onClose} {...rest} />}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

function LineItemForm({
  invoiceId,
  serviceOptions,
  itemOptions,
  onClose,
  onSaved,
}: FormProps) {
  const [sourceType, setSourceType] = useState<SourceType>("service");
  const [sourceId, setSourceId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  // Selling part of a pack. The amount is in the item's loose unit and the
  // server turns it into a pack quantity and a price, so neither is typed here.
  const [sellLoose, setSellLoose] = useState(false);
  const [looseQty, setLooseQty] = useState("");
  // Consumed during the visit rather than sold. Off the bill and off every
  // printed copy; the stock still moves and the cost still lands in analytics.
  const [isHidden, setIsHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Raw text from the barcode scanner (or manual entry) before it resolves to
  // an item. Scanners type the code then send Enter, so we resolve on Enter.
  const [barcode, setBarcode] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);

  const isItem = sourceType === "item";

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
  // Both sides are normalized to GTIN-14 first: imported codes are stored
  // 14-digit while a scanner reads the same product's EAN-13 label as 13, so
  // comparing the raw strings misses. See toGtin14.
  function scanBarcode(code: string) {
    const trimmed = code.trim();
    setScanError(null);
    if (!trimmed) return;
    const scanned = toGtin14(trimmed);
    const item = itemOptions.find(
      (o) => o.barcode != null && toGtin14(o.barcode) === scanned,
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

  // Only items configured for it can be sold loose, so the switch appears
  // nowhere else.
  const looseConfig = useMemo(
    () => (selectedItem ? looseConfigOf(selectedItem) : null),
    [selectedItem],
  );
  const loose = sellLoose && looseConfig != null;

  // Same arithmetic the server will run, so staff see the charge before saving
  // rather than after. The server still derives its own; this never leaves the
  // browser.
  const loosePreview = useMemo(() => {
    if (!loose || !looseConfig) return null;
    const amount = Number(looseQty);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const result = looseLine(amount, looseConfig);
    if (!result) {
      return `Minimum ${minLooseQuantity(looseConfig)} ${looseConfig.unit}`;
    }
    return `${amount} ${looseConfig.unit} at $${looseConfig.price.toFixed(2)} = $${result.lineTotal.toFixed(2)}, taking ${result.quantity} off stock`;
  }, [loose, looseConfig, looseQty]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isItem && !sourceId) {
      setError("Scan a barcode or search to select an inventory item.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<{ invoice: InvoiceDTO }>(
        `/api/invoices/${invoiceId}/line-items`,
        {
          method: "POST",
          body: {
            serviceId: isItem ? "" : sourceId,
            itemId: isItem ? sourceId : "",
            description,
            // A loose line sends only the amount asked for; the server derives
            // the pack quantity and the price it bills at.
            ...(loose ? { looseQty } : { quantity, unitPrice }),
            ...(isItem && isHidden ? { isHidden: true } : {}),
          },
        },
      );
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
      <DialogTitle>Add line item</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
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
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            fullWidth
          />
          {looseConfig && (
            <FormControlLabel
              control={
                <Switch
                  checked={sellLoose}
                  onChange={(e) => setSellLoose(e.target.checked)}
                />
              }
              label={`Sell by the ${looseConfig.unit}`}
            />
          )}

          {loose && looseConfig ? (
            <TextField
              label={`Amount (${looseConfig.unit})`}
              type="number"
              value={looseQty}
              onChange={(e) => setLooseQty(e.target.value)}
              slotProps={{
                htmlInput: {
                  min: minLooseQuantity(looseConfig),
                  step: "0.001",
                },
              }}
              required
              fullWidth
              helperText={
                loosePreview ??
                `$${looseConfig.price.toFixed(2)} per ${looseConfig.unit}, minimum ${minLooseQuantity(looseConfig)} ${looseConfig.unit}`
              }
            />
          ) : (
            <Stack direction="row" spacing={2}>
              <TextField
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                slotProps={{
                  htmlInput: { min: 0.001, step: "0.001" },
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
                // A hidden line is never charged, and most consumables have no
                // sale price to type in the first place.
                required={!isHidden}
                disabled={isHidden}
                fullWidth
                helperText={isHidden ? "Not charged" : undefined}
              />
            </Stack>
          )}

          {/* Only stock can be consumed: a service has nothing to take off a
              shelf and no cost to expense, so hiding one would drop it off the
              bill and leave nothing behind at all. */}
          {isItem && (
            <FormControlLabel
              control={
                <Switch
                  checked={isHidden}
                  onChange={(e) => {
                    setIsHidden(e.target.checked);
                    // A hidden line is not sold, so selling part of a pack is
                    // not a thing it can be doing.
                    if (e.target.checked) setSellLoose(false);
                  }}
                />
              }
              label="Used in the clinic, not charged"
            />
          )}
          {isHidden && (
            <Alert severity="info" icon={<VisibilityOffIcon />}>
              This line stays off the printed invoice and out of the total.
              Issuing takes it off the shelf and files what it cost as a running
              cost under {CLINIC_USE_COST_CATEGORY}.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? "Saving…" : "Add"}
        </Button>
      </DialogActions>
    </form>
  );
}
