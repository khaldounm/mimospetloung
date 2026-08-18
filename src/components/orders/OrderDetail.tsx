"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { apiRequest } from "@/utils/api-client";
import { formatDate, formatMoney } from "@/utils/format";
import { suggestedReorderQuantity } from "@/utils/inventory";
import {
  DEFAULT_VAT_RATE,
  NO_SUPPLIER_LABEL,
  ORDER_STATUS_COLOR,
} from "@/constants/order";
import type {
  InventoryItemDTO,
  PurchaseOrderDTO,
  SupplierDTO,
} from "@/types/entities";
import ReceiveOrderDialog from "./ReceiveOrderDialog";

interface Props {
  initialOrder: PurchaseOrderDTO;
  items: InventoryItemDTO[];
  suppliers: SupplierDTO[];
  canWrite: boolean;
  canReceive: boolean;
}

// One editable money row in the totals block. Uncontrolled so typing never
// round-trips, committing only on blur when the value actually changed.
function ChargeRow({
  label,
  value,
  editable,
  span,
  hint,
  applyValue,
  onCommit,
}: {
  label: string;
  value: string | null;
  editable: boolean;
  span: number;
  hint?: string;
  /** When set, the hint becomes a button that fills the field with this. */
  applyValue?: string;
  onCommit: (value: string) => void;
}) {
  const clickableHint = editable && applyValue !== undefined;
  return (
    <TableRow>
      <TableCell colSpan={span} align="right">
        {label}
        {hint && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            {clickableHint ? (
              <Link
                component="button"
                type="button"
                variant="caption"
                underline="hover"
                onClick={() => onCommit(applyValue)}
              >
                {hint}
              </Link>
            ) : (
              hint
            )}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        {editable ? (
          <TextField
            // Uncontrolled so typing never round-trips, but remounted when the
            // committed value changes, so applying the hint updates what is on
            // screen rather than leaving a stale figure in the box.
            key={value ?? ""}
            type="number"
            size="small"
            defaultValue={value ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (value ?? "")) onCommit(e.target.value);
            }}
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            sx={{ width: 120 }}
          />
        ) : (
          formatMoney(value ?? 0)
        )}
      </TableCell>
      {editable && <TableCell />}
    </TableRow>
  );
}

export default function OrderDetail({
  initialOrder,
  items,
  suppliers,
  canWrite,
  canReceive,
}: Props) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<InventoryItemDTO | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);

  // Memoized so the fallback empty array is stable across renders and does not
  // invalidate the picker below on every pass.
  const lines = useMemo(() => order.lines ?? [], [order.lines]);
  // A Partial order is no longer editable: part of it is already booked into
  // stock, so changing an ordered quantity or cost would rewrite history. It can
  // still take deliveries, which is what receivable covers.
  const editable = order.status === "Draft" || order.status === "Placed";
  const receivable = editable || order.status === "Partial";
  const canEdit = canWrite && editable;

  // Items already on the order are filtered out of the picker: adding one again
  // bumps its quantity, which is confusing to trigger from an "add item" box.
  const pickable = useMemo(() => {
    const onOrder = new Set(lines.map((l) => l.itemId));
    return items.filter((i) => !onOrder.has(i.itemId));
  }, [items, lines]);

  const missingCost = lines.filter((l) => l.unitCost == null).length;

  // What VAT would come to at the order's rate. Offered as a hint rather than
  // written automatically, so the figure on the actual bill always wins.
  //
  // Rounded to whole cents exactly once, and both the hint and the value the
  // apply link writes read from that. Formatting the raw product two different
  // ways does not agree: 20.50 at 11% is 2.255, which Intl renders as $2.26
  // while toFixed(2) yields "2.25", because the float sits just under the
  // halfway point. That made the label contradict the button by a cent.
  const suggestedTaxString = (
    Math.round(
      Number(order.taxableBase) * Number(order.taxRate ?? DEFAULT_VAT_RATE),
    ) / 100
  ).toFixed(2);

  // Every mutation returns the whole order, so the view is always the server's
  // truth rather than a locally patched guess.
  async function mutate(
    url: string,
    options: { method?: string; body?: unknown },
  ) {
    setError(null);
    setBusy(true);
    try {
      const res = await apiRequest<{ order: PurchaseOrderDTO }>(url, options);
      setOrder(res.order);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const patchOrder = (body: Record<string, unknown>) =>
    mutate(`/api/orders/${order.orderId}`, { method: "PATCH", body });

  const patchLine = (lineId: number, body: Record<string, unknown>) =>
    mutate(`/api/orders/${order.orderId}/lines/${lineId}`, {
      method: "PATCH",
      body,
    });

  async function addItem(item: InventoryItemDTO) {
    const ok = await mutate(`/api/orders/${order.orderId}/lines`, {
      method: "POST",
      body: {
        itemId: item.itemId,
        quantityOrdered: suggestedReorderQuantity(item),
      },
    });
    if (ok) setPicked(null);
  }

  async function removeLine(lineId: number) {
    await mutate(`/api/orders/${order.orderId}/lines/${lineId}`, {
      method: "DELETE",
    });
  }

  async function transition(action: "place" | "cancel" | "close-short") {
    if (action === "cancel" && !window.confirm("Cancel this order?")) return;
    if (
      action === "close-short" &&
      !window.confirm(
        "Close this order short? It settles at what actually arrived, and the shortfall stays on record.",
      )
    ) {
      return;
    }
    await mutate(`/api/orders/${order.orderId}/${action}`, { method: "POST" });
  }

  async function deleteDraft() {
    if (!window.confirm("Delete this draft? Its lines go with it.")) return;
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/orders/${order.orderId}`, { method: "DELETE" });
      router.push("/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setBusy(false);
    }
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.5 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="h4">
            {order.reference || `Order #${order.orderId}`}
          </Typography>
          <Chip
            size="small"
            color={ORDER_STATUS_COLOR[order.status]}
            label={order.status}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          {canEdit && order.status === "Draft" && (
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => void transition("place")}
            >
              Place order
            </Button>
          )}
          {canWrite && canReceive && receivable && order.hasOutstanding && (
            <Button
              variant="contained"
              color="success"
              disabled={busy}
              onClick={() => setReceiveOpen(true)}
            >
              {order.status === "Partial" ? "Receive rest" : "Receive"}
            </Button>
          )}
          {canWrite && order.status === "Partial" && (
            <Button
              color="warning"
              disabled={busy}
              onClick={() => void transition("close-short")}
            >
              Close short
            </Button>
          )}
          {canEdit && (
            <Button
              color="warning"
              disabled={busy}
              onClick={() => void transition("cancel")}
            >
              Cancel order
            </Button>
          )}
          {canWrite && order.status === "Draft" && (
            <Button
              color="error"
              disabled={busy}
              onClick={() => void deleteDraft()}
            >
              Delete
            </Button>
          )}
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Started {formatDate(order.createdAt)}
        {order.orderedOn ? ` · placed ${formatDate(order.orderedOn)}` : ""}
        {order.receivedOn ? ` · received ${formatDate(order.receivedOn)}` : ""}
        {order.createdByName ? ` · by ${order.createdByName}` : ""}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {order.supplierId == null && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          These items have no usual supplier. Pick one below to place the order,
          or set each item&apos;s supplier from Inventory.
        </Alert>
      )}

      {editable && missingCost > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {missingCost} line(s) still have no unit cost. Receiving needs a cost
          on every line, since it becomes the item&apos;s last cost and is what
          the profit report charges when the stock sells.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            select
            label="Supplier"
            size="small"
            value={order.supplierId != null ? String(order.supplierId) : ""}
            onChange={(e) =>
              void patchOrder({ supplierId: e.target.value || null })
            }
            disabled={!canEdit || busy}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">{NO_SUPPLIER_LABEL}</MenuItem>
            {suppliers.map((s) => (
              <MenuItem key={s.supplierId} value={String(s.supplierId)}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Their reference"
            size="small"
            defaultValue={order.reference ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (order.reference ?? "")) {
                void patchOrder({ reference: e.target.value });
              }
            }}
            disabled={!canEdit || busy}
            placeholder="Supplier's order or invoice number"
            fullWidth
          />
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">In stock</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Delivered</TableCell>
              <TableCell align="right">Unit cost</TableCell>
              <TableCell align="right">Line total</TableCell>
              {canEdit && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Nothing on this order yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              lines.map((l) => (
                <TableRow key={l.lineId} hover>
                  <TableCell>
                    {l.itemName}
                    {l.unit && (
                      <Typography variant="caption" color="text.secondary">
                        {` (${l.unit})`}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {l.currentStock}
                    {l.currentStock <= l.reorderLevel && l.reorderLevel > 0 && (
                      <Chip
                        size="small"
                        color="warning"
                        label="Low"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {canEdit ? (
                      <TextField
                        type="number"
                        size="small"
                        defaultValue={l.quantityOrdered}
                        onBlur={(e) => {
                          if (e.target.value !== l.quantityOrdered) {
                            void patchLine(l.lineId, {
                              quantityOrdered: e.target.value,
                            });
                          }
                        }}
                        slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                        sx={{ width: 110 }}
                      />
                    ) : (
                      l.quantityOrdered
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {l.quantityReceived}
                    {Number(l.quantityOutstanding) > 0 &&
                      Number(l.quantityReceived) > 0 && (
                        <Typography
                          variant="caption"
                          color="warning.main"
                          sx={{ display: "block" }}
                        >
                          {l.quantityOutstanding} still due
                        </Typography>
                      )}
                  </TableCell>
                  <TableCell align="right">
                    {canEdit ? (
                      <TextField
                        type="number"
                        size="small"
                        defaultValue={l.unitCost ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== (l.unitCost ?? "")) {
                            void patchLine(l.lineId, {
                              unitCost: e.target.value,
                            });
                          }
                        }}
                        slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                        error={l.unitCost == null}
                        sx={{ width: 120 }}
                      />
                    ) : (
                      formatMoney(l.unitCost)
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {formatMoney(l.lineTotal)}
                  </TableCell>
                  {canEdit && (
                    <TableCell align="right">
                      <Tooltip title="Remove from order">
                        <IconButton
                          size="small"
                          disabled={busy}
                          onClick={() => void removeLine(l.lineId)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} align="right">
                Subtotal
              </TableCell>
              <TableCell align="right">{formatMoney(order.subtotal)}</TableCell>
              {canEdit && <TableCell />}
            </TableRow>
            <ChargeRow
              label="Discount"
              value={order.discountAmount}
              editable={canEdit}
              span={5}
              onCommit={(v) => void patchOrder({ discountAmount: v })}
            />
            <ChargeRow
              label="Delivery"
              value={order.shippingAmount}
              editable={canEdit}
              span={5}
              onCommit={(v) => void patchOrder({ shippingAmount: v })}
            />
            <ChargeRow
              // An amount, not a rate: the supplier's own rounding has to be
              // matchable. The label says so, and the hint below fills in what
              // the rate comes to so nobody has to retype it.
              label="VAT amount"
              value={order.taxAmount}
              editable={canEdit}
              span={5}
              hint={
                canEdit
                  ? `Apply ${order.taxRate ?? DEFAULT_VAT_RATE}% of ${formatMoney(order.taxableBase)} = ${formatMoney(suggestedTaxString)}`
                  : undefined
              }
              applyValue={canEdit ? suggestedTaxString : undefined}
              onCommit={(v) => void patchOrder({ taxAmount: v })}
            />
            <TableRow>
              <TableCell colSpan={5} align="right">
                <Typography sx={{ fontWeight: 700 }}>Total</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography sx={{ fontWeight: 700 }}>
                  {formatMoney(order.total)}
                </Typography>
              </TableCell>
              {canEdit && <TableCell />}
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>

      {canEdit && (
        <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: "center" }}>
          <Autocomplete
            options={pickable}
            value={picked}
            onChange={(_e, value) => setPicked(value)}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.itemId === b.itemId}
            renderOption={(optionProps, option) => {
              // MUI derives its default option key from getOptionLabel, and
              // item names are not unique (there are genuinely two "Cosmo
              // sterilized cat salmon-3kg"), so that collides. Drop MUI's key,
              // use the id, and show the unit so the two can be told apart.
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { key, ...rest } = optionProps;
              return (
                <li key={option.itemId} {...rest}>
                  {option.name}
                  {option.unit && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                    >
                      {` (${option.unit})`}
                    </Typography>
                  )}
                </li>
              );
            }}
            renderInput={(inputParams) => (
              <TextField {...inputParams} label="Add an item" size="small" />
            )}
            sx={{ width: 320 }}
          />
          <Button
            variant="outlined"
            disabled={!picked || busy}
            onClick={() => picked && void addItem(picked)}
          >
            Add
          </Button>
        </Stack>
      )}

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <TextField
          label="Notes"
          defaultValue={order.notes ?? ""}
          onBlur={(e) => {
            if (e.target.value !== (order.notes ?? "")) {
              void patchOrder({ notes: e.target.value });
            }
          }}
          disabled={!canEdit || busy}
          multiline
          minRows={2}
          fullWidth
        />
      </Paper>

      <ReceiveOrderDialog
        open={receiveOpen}
        order={order}
        onClose={() => setReceiveOpen(false)}
        onReceived={(next) => {
          setOrder(next);
          router.refresh();
        }}
      />
    </Box>
  );
}
