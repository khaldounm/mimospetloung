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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import {
  DEFAULT_DISCOUNT_UNIT,
  DISCOUNT_UNITS,
  type DiscountUnit,
} from "@/constants/order";
import { CURRENCY } from "@/constants/clinic";
import { discountExceedsCost, netUnitCost } from "@/utils/discount";
import { formatMoney } from "@/utils/format";
import { toDateOnly } from "@/utils/format";
import { toGtin14 } from "@/utils/barcode";
import { parseGs1 } from "@/utils/gs1";
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
    // Wider than the usual dialog: the delivery table carries cost, discount and
    // net side by side, and squeezing them wraps the item name to four lines.
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
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
      outstanding.map((l) => {
        const loose =
          l.looseUnit != null &&
          l.looseQty != null &&
          Number(l.quantityOrdered) > 0
            ? (Number(l.looseQty) / Number(l.quantityOrdered)) *
              Number(l.quantityOutstanding)
            : null;
        return [
          l.lineId,
          loose != null ? String(loose) : l.quantityOutstanding,
        ];
      }),
    ),
  );
  // Seeded from the order, which was raised at an estimate. Staff correct it
  // against the delivery note, so the figure booked is the one invoiced.
  const [costs, setCosts] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      outstanding.map((l) => {
        // On a loose line the cost is quoted per loose unit, so the stored
        // per-pack figure is divided back down to be edited in the same terms.
        const perUnit =
          l.looseUnit != null &&
          l.looseQty != null &&
          Number(l.quantityOrdered) > 0
            ? Number(l.looseQty) / Number(l.quantityOrdered)
            : null;
        if (perUnit && l.unitCost != null) {
          return [
            l.lineId,
            (Number(l.unitCost) / perUnit).toFixed(4).replace(/\.?0+$/, ""),
          ];
        }
        return [l.lineId, l.unitCost ?? ""];
      }),
    ),
  );
  // A trade discount off the invoiced cost, per line. Not stored anywhere: it
  // reduces the unit cost and the net is what books, so the order total, what
  // the supplier is owed and the item's cost price all follow it without
  // needing to know a discount was taken.
  const [discounts, setDiscounts] = useState<Record<number, string>>({});
  const [discountUnits, setDiscountUnits] = useState<
    Record<number, DiscountUnit>
  >({});

  // One scan of a GS1 DataMatrix fills the lot and expiry for whichever line
  // the carton belongs to. That is the whole point of parsing the symbol: the
  // alternative is staff reading two fields off a box and typing them, per
  // line, per delivery, which is how expiry data stops being entered.
  const [scan, setScan] = useState("");
  const [scanNote, setScanNote] = useState<string | null>(null);

  // Lot and expiry off the carton, for perishable lines only.
  const [lots, setLots] = useState<Record<number, string>>({});
  const [expiries, setExpiries] = useState<Record<number, string>>({});
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

  // A line raised in kilos is received in kilos. The pack size is recoverable
  // from the line itself (200 kg ordered as 10 bags means 20 per bag), so
  // nothing extra has to be carried down for this.
  function looseOf(line: PurchaseOrderLineDTO) {
    if (line.looseUnit == null || line.looseQty == null) return null;
    const ordered = Number(line.quantityOrdered);
    const looseOrdered = Number(line.looseQty);
    if (!(ordered > 0) || !(looseOrdered > 0)) return null;
    const perUnit = looseOrdered / ordered;
    if (!Number.isFinite(perUnit) || perUnit <= 0) return null;
    return {
      unit: line.looseUnit,
      perUnit,
      outstanding: Number(line.quantityOutstanding) * perUnit,
    };
  }

  function costOf(line: PurchaseOrderLineDTO) {
    return (costs[line.lineId] ?? "").trim();
  }
  function missingCost(line: PurchaseOrderLineDTO) {
    const raw = costOf(line);
    return (
      Number(quantities[line.lineId]) > 0 &&
      (raw === "" || !Number.isFinite(Number(raw)) || Number(raw) < 0)
    );
  }
  function discountOf(line: PurchaseOrderLineDTO) {
    const raw = (discounts[line.lineId] ?? "").trim();
    if (raw === "") return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  function unitOf(line: PurchaseOrderLineDTO): DiscountUnit {
    return discountUnits[line.lineId] ?? DEFAULT_DISCOUNT_UNIT;
  }
  // What the line will actually book at, which is what every downstream figure
  // is built from. Shown under the discount so the net is never a surprise.
  function netOf(line: PurchaseOrderLineDTO) {
    const cost = Number(costOf(line));
    if (!Number.isFinite(cost)) return null;
    return netUnitCost(cost, discountOf(line), unitOf(line));
  }
  function badDiscount(line: PurchaseOrderLineDTO) {
    if (Number(quantities[line.lineId]) <= 0) return false;
    const raw = (discounts[line.lineId] ?? "").trim();
    if (raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
      return true;
    }
    return discountExceedsCost(
      Number(costOf(line)),
      discountOf(line),
      unitOf(line),
    );
  }

  const anyMissingCost = outstanding.some(missingCost);
  const anyBadDiscount = outstanding.some(badDiscount);
  // The lot and expiry column only appears when something on this delivery
  // actually perishes, so an order of leashes looks exactly as it always did.
  const anyPerishable = outstanding.some((l) => l.tracksExpiry);

  // Correcting a cost moves the order total and what the supplier is owed, so
  // say so before it happens rather than letting the balance shift silently.
  // Compared on the NET, since that is the figure that will move the balance.
  // Taking a discount is itself a repricing and should say so.
  const repriced = entered.filter(
    (l) =>
      !missingCost(l) && l.unitCost != null && netOf(l) !== Number(l.unitCost),
  );

  function applyScan(raw: string) {
    const parsed = parseGs1(raw);
    if (!parsed?.gtin) {
      setScanNote("That code carries no product number. Scan the 2D symbol.");
      return;
    }
    const target = outstanding.find(
      (l) => l.barcode && toGtin14(l.barcode) === parsed.gtin,
    );
    if (!target) {
      setScanNote(`Nothing on this order matches ${parsed.gtin}.`);
      return;
    }
    if (parsed.lotNumber) {
      setLots((prev) => ({ ...prev, [target.lineId]: parsed.lotNumber! }));
    }
    if (parsed.expiryDate) {
      setExpiries((prev) => ({
        ...prev,
        [target.lineId]: parsed.expiryDate!.toISOString().slice(0, 10),
      }));
    }
    const filled = [
      parsed.lotNumber ? `lot ${parsed.lotNumber}` : null,
      parsed.expiryDate
        ? `expiry ${parsed.expiryDate.toISOString().slice(0, 10)}`
        : null,
    ].filter(Boolean);
    setScanNote(
      filled.length > 0
        ? `${target.itemName}: ${filled.join(", ")}`
        : `${target.itemName} matched, but the code carried no lot or expiry.`,
    );
    setScan("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lines = outstanding
      .map((l) => {
        const loose = looseOf(l);
        const typed = Number(quantities[l.lineId]);
        const cost = costOf(l) === "" ? undefined : Number(costOf(l));
        // The gross cost and the discount both go up; the server does the
        // arithmetic, so what books can never depend on the browser.
        const discount = { discount: discountOf(l), discountUnit: unitOf(l) };
        const batch = l.tracksExpiry
          ? {
              lotNumber: (lots[l.lineId] ?? "").trim() || undefined,
              expiryDate: (expiries[l.lineId] ?? "").trim() || undefined,
            }
          : {};
        return loose
          ? {
              lineId: l.lineId,
              quantity: 0,
              looseQty: typed,
              unitCost: cost,
              ...discount,
              ...batch,
            }
          : {
              lineId: l.lineId,
              quantity: typed,
              unitCost: cost,
              ...discount,
              ...batch,
            };
      })
      .filter((l) => {
        const typed = "looseQty" in l ? l.looseQty : l.quantity;
        return typed != null && Number.isFinite(typed) && typed > 0;
      });

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
          Enter what actually turned up, and the cost the supplier invoiced.
          Anything left short stays outstanding, and you can receive against
          this order again when the rest arrives.
        </DialogContentText>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {anyMissingCost && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Every line arriving needs a unit cost. It becomes the item&apos;s
            cost price and is what the profit report charges when that stock
            sells.
          </Alert>
        )}

        {anyBadDiscount && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            A discount is larger than the cost it comes off. Check whether a
            rate was typed as an amount, or the other way round.
          </Alert>
        )}

        {repriced.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {repriced.length === 1
              ? "One line is priced differently to the order."
              : `${repriced.length} lines are priced differently to the order.`}{" "}
            The order total and what this supplier is owed will follow what you
            enter here.
          </Alert>
        )}

        <Stack spacing={2}>
          {anyPerishable && (
            <TextField
              label="Scan carton"
              value={scan}
              onChange={(e) => {
                setScan(e.target.value);
                setScanNote(null);
              }}
              onKeyDown={(e) => {
                // Scanners type the code then send Enter. Intercept it so the
                // scan fills the line instead of submitting the delivery.
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyScan(scan);
                }
              }}
              placeholder="Scan the 2D code to fill lot and expiry"
              helperText={
                scanNote ?? "One scan fills the lot and expiry for that line"
              }
              fullWidth
            />
          )}

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
                <TableCell align="right">Unit cost</TableCell>
                <TableCell align="right">Discount</TableCell>
                <TableCell align="right">Net cost</TableCell>
                {anyPerishable && <TableCell>Lot / expiry</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {outstanding.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={anyPerishable ? 9 : 8} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      Everything on this order has already been received.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                outstanding.map((l) => {
                  const loose = looseOf(l);
                  const perUnit = loose?.perUnit ?? 1;
                  const suffix = loose ? ` ${loose.unit}` : "";
                  return (
                    <TableRow key={l.lineId}>
                      <TableCell>
                        {l.itemName}
                        {l.unit && (
                          <Typography variant="caption" color="text.secondary">
                            {` (${l.unit})`}
                          </Typography>
                        )}
                        {loose && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block" }}
                          >
                            {`ordered by the ${loose.unit}`}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {`${Number(l.quantityOrdered) * perUnit}${suffix}`}
                      </TableCell>
                      <TableCell align="right">
                        {`${Number(l.quantityReceived) * perUnit}${suffix}`}
                      </TableCell>
                      <TableCell align="right">
                        {`${Number(l.quantityOutstanding) * perUnit}${suffix}`}
                      </TableCell>
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
                          slotProps={{
                            htmlInput: {
                              min: 0,
                              max: Number(l.quantityOutstanding) * perUnit,
                              step: "0.001",
                            },
                          }}
                          sx={{ width: 120 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={costs[l.lineId] ?? ""}
                          onChange={(e) =>
                            setCosts((prev) => ({
                              ...prev,
                              [l.lineId]: e.target.value,
                            }))
                          }
                          error={missingCost(l)}
                          placeholder="0.00"
                          helperText={loose ? `per ${loose.unit}` : undefined}
                          slotProps={{
                            htmlInput: {
                              min: 0,
                              step: "0.01",
                              "aria-label": `Unit cost for ${l.itemName}`,
                            },
                          }}
                          sx={{ width: 120 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ justifyContent: "flex-end" }}
                        >
                          <TextField
                            type="number"
                            size="small"
                            value={discounts[l.lineId] ?? ""}
                            onChange={(e) =>
                              setDiscounts((prev) => ({
                                ...prev,
                                [l.lineId]: e.target.value,
                              }))
                            }
                            error={badDiscount(l)}
                            placeholder="0"
                            slotProps={{
                              htmlInput: {
                                min: 0,
                                step: "0.01",
                                "aria-label": `Discount for ${l.itemName}`,
                              },
                            }}
                            sx={{ width: 90 }}
                          />
                          <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={unitOf(l)}
                            onChange={(_, next: DiscountUnit | null) =>
                              next &&
                              setDiscountUnits((prev) => ({
                                ...prev,
                                [l.lineId]: next,
                              }))
                            }
                            aria-label={`Discount unit for ${l.itemName}`}
                          >
                            {DISCOUNT_UNITS.map((u) => (
                              <ToggleButton
                                key={u}
                                value={u}
                                sx={{ px: 1.25 }}
                                aria-label={
                                  u === "percent" ? "percent" : "amount"
                                }
                              >
                                {u === "percent" ? "%" : CURRENCY.symbol}
                              </ToggleButton>
                            ))}
                          </ToggleButtonGroup>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        {(() => {
                          const net = netOf(l);
                          if (net == null || missingCost(l)) return "-";
                          const changed = discountOf(l) > 0;
                          return (
                            <>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: changed ? 700 : 400 }}
                              >
                                {formatMoney(net)}
                              </Typography>
                              {loose && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: "block" }}
                                >
                                  {`per ${loose.unit}`}
                                </Typography>
                              )}
                            </>
                          );
                        })()}
                      </TableCell>
                      {anyPerishable && (
                        <TableCell>
                          {l.tracksExpiry ? (
                            <Stack direction="row" spacing={1}>
                              <TextField
                                size="small"
                                placeholder="Lot"
                                value={lots[l.lineId] ?? ""}
                                onChange={(e) =>
                                  setLots((prev) => ({
                                    ...prev,
                                    [l.lineId]: e.target.value,
                                  }))
                                }
                                slotProps={{
                                  htmlInput: {
                                    "aria-label": `Lot number for ${l.itemName}`,
                                  },
                                }}
                                sx={{ width: 110 }}
                              />
                              <TextField
                                size="small"
                                type="date"
                                value={expiries[l.lineId] ?? ""}
                                onChange={(e) =>
                                  setExpiries((prev) => ({
                                    ...prev,
                                    [l.lineId]: e.target.value,
                                  }))
                                }
                                slotProps={{
                                  inputLabel: { shrink: true },
                                  htmlInput: {
                                    "aria-label": `Expiry date for ${l.itemName}`,
                                  },
                                }}
                                sx={{ width: 150 }}
                              />
                            </Stack>
                          ) : (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              not perishable
                            </Typography>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
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
          disabled={
            saving ||
            outstanding.length === 0 ||
            anyMissingCost ||
            anyBadDiscount
          }
        >
          {saving ? "Receiving…" : "Receive"}
        </Button>
      </DialogActions>
    </form>
  );
}
