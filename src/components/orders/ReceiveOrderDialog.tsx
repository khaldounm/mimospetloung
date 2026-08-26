"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
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
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
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
import { beepAccept, beepReject } from "@/utils/beep";
import { parseGs1, scannedLookupCode } from "@/utils/gs1";
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
    // Wider than the usual dialog: the delivery table carries a quantity, a
    // cost, a discount and a batch per line, and the item names are long.
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      {open && <ReceiveForm onClose={onClose} {...rest} />}
    </Dialog>
  );
}

// The height of the caption line every cell reserves under its control.
// Roughly one line of the caption variant.
const CAPTION_LINE = 18;

// One cell of the delivery table: a control, and a caption line under it that
// is reserved whether or not there is anything to say.
//
// The reserved line is the whole point. A cell centred on the row puts its
// control's midpoint half a caption above the row's, so cells that carried a
// caption (the outstanding quantity, the net cost) sat visibly higher than the
// plain input beside them. Reserving the line in every cell makes that offset
// identical everywhere, which puts every control on one line and every caption
// on another, whatever heights they happen to be: the stacked lot and expiry
// straddle the same line the single inputs sit on.
function DeliveryCell({
  align = "flex-end",
  caption,
  children,
}: {
  align?: "flex-start" | "flex-end";
  caption?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Stack spacing={0.25} sx={{ alignItems: align }}>
      {children}
      <Box
        sx={{
          minHeight: CAPTION_LINE,
          display: "flex",
          alignItems: "center",
        }}
      >
        {typeof caption === "string" ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ whiteSpace: "nowrap" }}
          >
            {caption}
          </Typography>
        ) : (
          caption
        )}
      </Box>
    </Stack>
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

  // One box, two jobs. A delivery can be dozens of lines and whoever is
  // booking it is holding a carton, not reading a list: scanning the code on
  // the box jumps to its line (and, on a GS1 DataMatrix, fills the lot and
  // expiry printed alongside the product number), while typing part of a name
  // narrows the table down to what is in front of them.
  const [scan, setScan] = useState("");
  const [scanNote, setScanNote] = useState<string | null>(null);
  // The line a scan last landed on. Kept until the next scan so the eye can
  // find it again after the table has scrolled, and stamped with the time so
  // scanning the same carton twice still re-triggers the jump.
  const [hit, setHit] = useState<{ lineId: number; at: number } | null>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  // Laid out before the browser paints, and instantly rather than smoothly. A
  // scan clears the search box in the same update, so the table grows back from
  // a filtered handful of rows to the whole delivery: scrolling any later than
  // this lands well past the row, and a smooth scroll is abandoned part-way by
  // the resize. Whoever scanned wants the line in front of them, not a journey
  // to it.
  useLayoutEffect(() => {
    if (!hit) return;
    rowRefs.current[hit.lineId]?.scrollIntoView({ block: "center" });
  }, [hit]);

  // Lot and expiry off the carton, for perishable lines only.
  const [lots, setLots] = useState<Record<number, string>>({});
  const [expiries, setExpiries] = useState<Record<number, string>>({});
  const [receivedOn, setReceivedOn] = useState(
    () => toDateOnly(new Date()) ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Filtering is a view over the table and nothing more: quantities are held
  // per line id, so a line scrolled out of sight still books exactly what it
  // was seeded with. Hiding some of them is worth saying out loud, which the
  // note under the table does.
  const query = scan.trim().toLowerCase();
  const visible =
    query === ""
      ? outstanding
      : outstanding.filter(
          (l) =>
            l.itemName.toLowerCase().includes(query) ||
            (l.barcode ?? "").toLowerCase().includes(query),
        );
  const hiddenCount = outstanding.length - visible.length;

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

  // Enter, or the carriage return a scanner sends after the code, resolves
  // whatever is in the box as a barcode. Most of what arrives at goods receipt
  // is a plain EAN-13 on an outer carton; only pharma carries the 2D symbol.
  // scannedLookupCode covers both, returning the (01) out of a GS1 string and
  // passing anything else straight through, so a plain code is no longer
  // turned away for carrying no product number.
  //
  // A code that matches nothing leaves the text where it is, still filtering
  // the table, rather than clearing what was typed.
  function applyScan(raw: string) {
    const code = scannedLookupCode(raw);
    if (code === "") return;
    const target = outstanding.find(
      (l) => l.barcode && toGtin14(l.barcode) === toGtin14(code),
    );
    if (!target) {
      beepReject();
      setScanNote(
        `Nothing on this order matches ${code}. Type part of the name to search instead.`,
      );
      return;
    }

    const parsed = parseGs1(raw);
    if (parsed?.lotNumber) {
      setLots((prev) => ({ ...prev, [target.lineId]: parsed.lotNumber! }));
    }
    if (parsed?.expiryDate) {
      setExpiries((prev) => ({
        ...prev,
        [target.lineId]: parsed.expiryDate!.toISOString().slice(0, 10),
      }));
    }
    const filled = [
      parsed?.lotNumber ? `lot ${parsed.lotNumber}` : null,
      parsed?.expiryDate
        ? `expiry ${parsed.expiryDate.toISOString().slice(0, 10)}`
        : null,
    ].filter(Boolean);
    beepAccept();
    setScanNote(
      filled.length > 0
        ? `${target.itemName}: ${filled.join(", ")}`
        : target.tracksExpiry
          ? `${target.itemName} matched, but the code carried no lot or expiry.`
          : `${target.itemName} matched.`,
    );
    setScan("");
    setHit({ lineId: target.lineId, at: Date.now() });
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
          <TextField
            label="Scan or search"
            value={scan}
            onChange={(e) => {
              setScan(e.target.value);
              setScanNote(null);
            }}
            onKeyDown={(e) => {
              // Scanners type the code then send Enter. Intercept it so the
              // scan resolves the line instead of submitting the delivery.
              if (e.key === "Enter") {
                e.preventDefault();
                applyScan(scan);
              }
            }}
            placeholder="Scan a carton, or type part of an item name"
            helperText={
              scanNote ??
              (anyPerishable
                ? "A scan jumps to that line and fills its lot and expiry. Typing narrows the list."
                : "A scan jumps to that line. Typing narrows the list.")
            }
            autoFocus
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <QrCodeScannerIcon />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            label="Delivery date"
            type="date"
            size="small"
            value={receivedOn}
            onChange={(e) => setReceivedOn(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 200 }}
          />

          {/* A last-resort escape hatch on a narrow screen: the table scrolls
              inside its own box rather than dragging the dialog, the alerts
              and the buttons sideways with it. */}
          <Box sx={{ overflowX: "auto" }}>
            <Table
              size="small"
              sx={{
                // Table cells align on their first text baseline, so a row
                // whose cells are different heights comes out staggered: the
                // item name and the quantity sit level with the lot field
                // while the expiry hangs below them. Everything centres on the
                // row instead.
                "& .MuiTableCell-root": { verticalAlign: "middle" },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">Outstanding</TableCell>
                  <TableCell align="right">Receiving now</TableCell>
                  <TableCell align="right">Unit cost</TableCell>
                  <TableCell align="right">Discount</TableCell>
                  {anyPerishable && <TableCell>Lot / expiry</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={anyPerishable ? 6 : 5} align="center">
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        {outstanding.length === 0
                          ? "Everything on this order has already been received."
                          : "Nothing on this order matches what you typed."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((l, index) => {
                    const loose = looseOf(l);
                    const perUnit = loose?.perUnit ?? 1;
                    const suffix = loose ? ` ${loose.unit}` : "";
                    const net = netOf(l);
                    const discounted = discountOf(l) > 0;
                    return (
                      <TableRow
                        key={l.lineId}
                        ref={(el) => {
                          rowRefs.current[l.lineId] = el;
                        }}
                        // Banded, because a delivery is a long column of
                        // near-identical rows and a quantity has to be carried
                        // across five columns of inputs without losing the line
                        // it belongs to. A scanned line is tinted harder than
                        // the banding so it still reads as picked out on a
                        // shaded row as well as a plain one. Both are set here
                        // rather than by a nth-child rule on the table, which
                        // would outrank the row's own colour and swallow it.
                        sx={{
                          backgroundColor:
                            hit?.lineId === l.lineId
                              ? "action.selected"
                              : index % 2 === 1
                                ? "action.hover"
                                : undefined,
                        }}
                      >
                        <TableCell sx={{ minWidth: 160 }}>
                          <DeliveryCell
                            align="flex-start"
                            caption={
                              loose ? `ordered by the ${loose.unit}` : undefined
                            }
                          >
                            <Box>
                              {l.itemName}
                              {l.unit && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {` (${l.unit})`}
                                </Typography>
                              )}
                            </Box>
                          </DeliveryCell>
                        </TableCell>
                        {/* Ordered, already in and outstanding were three
                            columns of the same fact: on a first delivery two of
                            them are the ordered quantity and a zero. Outstanding
                            is the one that governs what can be booked, so it
                            leads, and the other two sit under it as context. */}
                        <TableCell align="right">
                          <DeliveryCell
                            caption={
                              Number(l.quantityReceived) > 0
                                ? `of ${Number(l.quantityOrdered) * perUnit}, ${Number(l.quantityReceived) * perUnit} in`
                                : `of ${Number(l.quantityOrdered) * perUnit} ordered`
                            }
                          >
                            <Typography variant="body2">
                              {`${Number(l.quantityOutstanding) * perUnit}${suffix}`}
                            </Typography>
                          </DeliveryCell>
                        </TableCell>
                        <TableCell align="right">
                          <DeliveryCell>
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
                                  "aria-label": `Receiving now for ${l.itemName}`,
                                },
                              }}
                              sx={{ width: 110 }}
                            />
                          </DeliveryCell>
                        </TableCell>
                        <TableCell align="right">
                          <DeliveryCell
                            caption={loose ? `per ${loose.unit}` : undefined}
                          >
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
                              slotProps={{
                                htmlInput: {
                                  min: 0,
                                  step: "0.01",
                                  "aria-label": `Unit cost for ${l.itemName}`,
                                },
                              }}
                              sx={{ width: 110 }}
                            />
                          </DeliveryCell>
                        </TableCell>
                        {/* The net used to be a column of its own, which on an
                            undiscounted line simply repeated the unit cost next
                            to it. It belongs under the field that moves it. */}
                        <TableCell align="right">
                          <DeliveryCell
                            caption={
                              <Typography
                                variant="caption"
                                color={
                                  discounted ? "text.primary" : "text.secondary"
                                }
                                sx={{
                                  fontWeight: discounted ? 700 : 400,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {net == null || missingCost(l)
                                  ? "net -"
                                  : `net ${formatMoney(net)}${loose ? ` per ${loose.unit}` : ""}`}
                              </Typography>
                            }
                          >
                            <Stack direction="row" spacing={1}>
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
                                sx={{ width: 80 }}
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
                          </DeliveryCell>
                        </TableCell>
                        {anyPerishable && (
                          <TableCell>
                            <DeliveryCell align="flex-start">
                              {l.tracksExpiry ? (
                                // Stacked rather than side by side: two fields on
                                // one row cost 260px of table width, which is what
                                // pushed the last column off the dialog.
                                <Stack spacing={0.5} sx={{ width: 150 }}>
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
                            </DeliveryCell>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Box>

          {hiddenCount > 0 && (
            <Alert severity="info">
              Showing {visible.length} of {outstanding.length} lines. Receiving
              still books every line that has a quantity, not only the ones on
              screen.
            </Alert>
          )}

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
