"use client";

import { useState } from "react";
import {
  Box,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { apiRequest } from "@/utils/api-client";
import { formatMoney } from "@/utils/format";
import {
  formatLineQuantity,
  looseConfigOf,
  looseLine,
  minLooseQuantity,
} from "@/utils/inventory";
import type { InvoiceDTO, InvoiceLineItemDTO } from "@/types/entities";
import type { ItemLineOption } from "./LineItemDialog";

// Fixed column widths, shared with the table header so the two cannot drift.
// The table is laid out `fixed`, so these hold whatever the content is: a long
// product name wraps inside its column instead of shouldering the number
// columns out of alignment.
//
// The three editable columns split their space 60 / 15 / 25. Price is the wider
// of the two numbers: it carries cents and gets typed over far more often than a
// quantity.
//
// Everything is a plain percentage, and every column has one, because a fixed
// table layout ignores a `calc()` width that mixes a percentage with a length
// and silently falls back to dividing the row evenly. So the columns that are
// not typed into take a flat share and the rest is split by the ratio above.
//
// The table carries a minWidth instead, and its container scrolls: below that
// the number columns would be too narrow to type a price into.
export const LINE_ITEM_TABLE_MIN_WIDTH = 620;

// Table cells default to 16px of padding a side, which is 32px taken out of
// every column. On the narrow number columns that left the input barely wider
// than the digits in it, so the cells are tightened and the fields get the
// width the percentages above actually allocate.
export const LINE_ITEM_CELL_SX = { px: 0.5 } as const;

export function lineItemColumnWidths(editable: boolean) {
  // Total always gets a share; the controls column only exists on a draft.
  const total = 11;
  const controls = editable ? 11 : 0;
  const typed = 100 - total - controls;
  const share = (fraction: number) => `${(typed * fraction).toFixed(2)}%`;
  return {
    description: share(0.6),
    quantity: share(0.15),
    unitPrice: share(0.25),
    total: `${total}%`,
    controls: `${controls}%`,
  };
}

type Field = "description" | "quantity" | "unitPrice";

interface Props {
  invoiceId: number;
  line: InvoiceLineItemDTO;
  // The item behind an inventory line, when there is one. It carries the loose
  // setup, which decides whether the amount is typed in packs or by the kilo.
  item?: ItemLineOption;
  // Lines are only editable on a draft, and only by someone who can write.
  editable: boolean;
  onSaved: (invoice: InvoiceDTO) => void;
  onDelete: () => void;
  onError: (message: string) => void;
}

// A return reads as an ordinary line with a minus in front of it, which is easy
// to skim past on a busy counter, so the row says what it is.
function rowSx(line: InvoiceLineItemDTO) {
  return Number(line.quantity) < 0
    ? { "& td": { color: "warning.dark" } }
    : undefined;
}

export default function LineItemRow(props: Props) {
  return props.editable ? (
    <EditableRow {...props} />
  ) : (
    <ReadOnlyRow {...props} />
  );
}

function ReadOnlyRow({ line }: Props) {
  const cols = lineItemColumnWidths(false);
  return (
    <TableRow hover sx={rowSx(line)}>
      <TableCell sx={{ ...LINE_ITEM_CELL_SX, width: cols.description }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>{line.description}</Box>
          {line.isHidden && <ClinicUseTag />}
        </Stack>
      </TableCell>
      <TableCell
        align="right"
        sx={{ ...LINE_ITEM_CELL_SX, width: cols.quantity }}
      >
        {formatLineQuantity(line)}
      </TableCell>
      <TableCell
        align="right"
        sx={{ ...LINE_ITEM_CELL_SX, width: cols.unitPrice }}
      >
        {formatMoney(line.unitPrice)}
      </TableCell>
      <TableCell align="right" sx={{ ...LINE_ITEM_CELL_SX, width: cols.total }}>
        {line.isHidden ? <NotCharged /> : formatMoney(line.lineTotal)}
      </TableCell>
    </TableRow>
  );
}

function ClinicUseTag() {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
      Clinic use
    </Typography>
  );
}

function NotCharged() {
  return (
    <Typography variant="body2" color="text.secondary">
      Not charged
    </Typography>
  );
}

/**
 * A line that is always open for editing: no pencil, no save tick, no dialog.
 *
 * The counter corrects a price mid-sale, so the fastest possible path is the
 * field already being a field. Typing edits a draft and leaving the field
 * commits it; anything not being typed in still tracks the invoice, so a scan
 * that bumps this line's quantity shows up here without wiping what is
 * half-typed in another cell.
 */
function EditableRow({
  invoiceId,
  line,
  item,
  onSaved,
  onDelete,
  onError,
}: Props) {
  // Only the fields actually touched. Everything else reads from the invoice.
  const [draft, setDraft] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const cols = lineItemColumnWidths(true);

  const isItem = line.itemId != null;
  const looseConfig = item ? looseConfigOf(item) : null;
  // Whether this line is sold loose is fixed when it is added. Editing the
  // amount keeps it loose; the server re-derives the pack quantity and price
  // together so the two can never be saved disagreeing.
  const loose = line.looseQty != null && looseConfig != null;

  const saved: Record<Field, string> = {
    description: line.description,
    quantity: loose ? (line.looseQty ?? "") : line.quantity,
    unitPrice: line.unitPrice,
  };
  const valueOf = (field: Field) => draft[field] ?? saved[field];

  // Same arithmetic the server will run, so the total moves as the price is
  // typed rather than after it is saved.
  const preview = (() => {
    if (line.isHidden) return null;
    const quantity = Number(valueOf("quantity"));
    if (!Number.isFinite(quantity)) return null;
    if (loose && looseConfig) return looseLine(quantity, looseConfig);
    const unitPrice = Number(valueOf("unitPrice"));
    if (!Number.isFinite(unitPrice)) return null;
    return { lineTotal: quantity * unitPrice };
  })();

  async function commit(body: Record<string, unknown>, clear: Field[]) {
    setSaving(true);
    try {
      const data = await apiRequest<{ invoice: InvoiceDTO }>(
        `/api/invoices/${invoiceId}/line-items/${line.lineItemId}`,
        { method: "PATCH", body },
      );
      onSaved(data.invoice);
      // Hand these fields back to the invoice now that it agrees with them.
      setDraft((d) => {
        const next = { ...d };
        for (const field of clear) delete next[field];
        return next;
      });
    } catch (err) {
      // The draft is deliberately kept: whoever typed it should get the chance
      // to correct it rather than watch it snap back to the old figure.
      onError(err instanceof Error ? err.message : "Failed to save line");
    } finally {
      setSaving(false);
    }
  }

  // Leaving a field saves it, and only if it actually changed: tabbing across a
  // row must not fire four requests.
  //
  // The value comes from the input itself rather than from `draft`, which is a
  // render behind: a keystroke followed immediately by a blur would otherwise be
  // read through the closure that still has the old draft and dropped.
  function commitField(field: Field, value: string) {
    if (value === saved[field]) return;
    if (field === "quantity" && loose) {
      void commit({ looseQty: value }, ["quantity", "unitPrice"]);
      return;
    }
    void commit({ [field]: value }, [field]);
  }

  function fieldProps(field: Field) {
    return {
      value: valueOf(field),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((d) => ({ ...d, [field]: e.target.value })),
      onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
        commitField(field, e.target.value),
      onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Enter commits by leaving the field, Escape throws the edit away.
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft((d) => {
            const next = { ...d };
            delete next[field];
            return next;
          });
        }
      },
      size: "small" as const,
      fullWidth: true,
      disabled: saving,
    };
  }

  return (
    <TableRow sx={rowSx(line)}>
      <TableCell sx={{ ...LINE_ITEM_CELL_SX, width: cols.description }}>
        <TextField {...fieldProps("description")} />
      </TableCell>
      <TableCell sx={{ ...LINE_ITEM_CELL_SX, width: cols.quantity }}>
        <TextField
          {...fieldProps("quantity")}
          type="number"
          slotProps={{
            htmlInput: {
              min: loose && looseConfig ? minLooseQuantity(looseConfig) : 0.001,
              step: "0.001",
              style: { textAlign: "right" },
            },
            ...(loose && looseConfig
              ? {
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        {looseConfig.unit}
                      </InputAdornment>
                    ),
                  },
                }
              : {}),
          }}
        />
      </TableCell>
      <TableCell sx={{ ...LINE_ITEM_CELL_SX, width: cols.unitPrice }}>
        <TextField
          {...fieldProps("unitPrice")}
          type="number"
          // A clinic-use line is never charged, and a loose line's per-pack
          // price is derived from the amount rather than typed.
          disabled={saving || line.isHidden || loose}
          slotProps={{
            htmlInput: {
              min: 0,
              step: "0.01",
              style: { textAlign: "right" },
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">$</InputAdornment>
              ),
            },
          }}
        />
      </TableCell>
      <TableCell align="right" sx={{ ...LINE_ITEM_CELL_SX, width: cols.total }}>
        {line.isHidden ? (
          <NotCharged />
        ) : (
          <Typography variant="body2">
            {formatMoney(preview ? preview.lineTotal : Number(line.lineTotal))}
          </Typography>
        )}
      </TableCell>
      {/* The clinic-use switch sits where a save tick used to, which is what
          lets every row be the same height: there is one control block per row
          rather than one that appears only while editing. */}
      <TableCell
        align="right"
        sx={{ ...LINE_ITEM_CELL_SX, width: cols.controls }}
      >
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center", justifyContent: "flex-end" }}
        >
          {/* Only stock can be consumed: a service has nothing to take off a
              shelf and no cost to expense. Services still reserve the width so
              the delete buttons stay in one line down the table. */}
          {isItem ? (
            <Tooltip title="Used in the clinic, not charged">
              <Switch
                size="small"
                checked={line.isHidden}
                disabled={saving}
                onChange={(e) =>
                  void commit({ isHidden: e.target.checked }, [])
                }
                slotProps={{
                  input: {
                    "aria-label": "Used in the clinic, not charged",
                  },
                }}
              />
            </Tooltip>
          ) : (
            <Box sx={{ width: 38 }} />
          )}
          <IconButton
            size="small"
            aria-label="Remove line"
            onClick={onDelete}
            disabled={saving}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </TableCell>
    </TableRow>
  );
}
