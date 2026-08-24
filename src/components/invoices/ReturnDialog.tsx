"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { apiRequest } from "@/utils/api-client";
import { formatMoney } from "@/utils/format";
import type {
  InvoiceDTO,
  InvoiceListItemDTO,
  ReturnableInvoiceDTO,
  ReturnableLineDTO,
} from "@/types/entities";

interface Props {
  open: boolean;
  // The draft the return lines are being added to. It is also the document the
  // customer walks away with, so it can hold goods going out on the same visit.
  invoiceId: number;
  // Whose account this draft belongs to. Used to offer their past invoices, and
  // enforced again on the server: a return has to land where the sale did.
  clientId: number | null;
  onClose: () => void;
  onSaved: (invoice: InvoiceDTO) => void;
}

// What the counter has decided about one line of the source invoice.
interface Entry {
  quantity: string;
  restock: boolean;
  lotNumber: string;
  expiryDate: string;
}

export default function ReturnDialog({ open, ...rest }: Props) {
  return (
    <Dialog open={open} onClose={rest.onClose} fullWidth maxWidth="md">
      {open && <ReturnForm key={rest.invoiceId} {...rest} />}
    </Dialog>
  );
}

function ReturnForm({
  invoiceId,
  clientId,
  onClose,
  onSaved,
}: Omit<Props, "open">) {
  const [recent, setRecent] = useState<InvoiceListItemDTO[]>([]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<ReturnableInvoiceDTO | null>(null);
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // A named customer almost always brings back something from their last visit,
  // so their invoices are offered up front and typing a number is the fallback
  // rather than the only way in. A walk-in has no history to offer.
  useEffect(() => {
    if (clientId == null) return;
    let cancelled = false;
    void apiRequest<{ invoices: InvoiceListItemDTO[] }>(
      `/api/invoices?clientId=${clientId}`,
    )
      .then((r) => {
        if (!cancelled) {
          setRecent(
            r.invoices.filter(
              (i) => i.status !== "Draft" && i.status !== "Void",
            ),
          );
        }
      })
      .catch(() => {
        // The picker is a convenience; the number field still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function load(sourceInvoiceId: number) {
    setError(null);
    setLoading(true);
    try {
      const r = await apiRequest<{ invoice: ReturnableInvoiceDTO }>(
        `/api/invoices/${sourceInvoiceId}/returnable`,
      );
      setSource(r.invoice);
      setEntries(
        Object.fromEntries(
          r.invoice.lines.map((l) => [
            l.lineItemId,
            {
              quantity: "",
              restock: true,
              lotNumber: l.suggestedLotNumber ?? "",
              expiryDate: l.suggestedExpiryDate ?? "",
            },
          ]),
        ),
      );
    } catch (e) {
      setSource(null);
      setError(e instanceof Error ? e.message : "Could not load that invoice");
    } finally {
      setLoading(false);
    }
  }

  async function findByNumber() {
    const digits = query.replace(/\D/g, "");
    if (!digits) return;
    await load(Number(digits));
  }

  function update(lineItemId: number, patch: Partial<Entry>) {
    setEntries((prev) => ({
      ...prev,
      [lineItemId]: { ...prev[lineItemId], ...patch },
    }));
  }

  const chosen = source
    ? source.lines
        .map((l) => ({ line: l, entry: entries[l.lineItemId] }))
        .filter(({ entry }) => entry && Number(entry.quantity) > 0)
    : [];

  const refund = chosen.reduce(
    (sum, { line, entry }) =>
      sum + Number(entry.quantity) * Number(line.unitPrice),
    0,
  );

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const r = await apiRequest<{ invoice: InvoiceDTO }>(
        `/api/invoices/${invoiceId}/returns`,
        {
          method: "POST",
          body: {
            entries: chosen.map(({ line, entry }) => ({
              sourceLineItemId: line.lineItemId,
              quantity: Number(entry.quantity),
              restock: entry.restock,
              lotNumber: entry.lotNumber || undefined,
              expiryDate: entry.expiryDate || undefined,
            })),
          },
        },
      );
      onSaved(r.invoice);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the return");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogTitle>Take a return</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="body2" color="text.secondary">
            Find the invoice the goods were bought on, then choose what is
            coming back. The credit is added to this invoice, so anything the
            customer is taking instead can go on the same one.
          </Typography>

          <Stack direction="row" spacing={1}>
            <TextField
              label="Invoice number"
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void findByNumber();
                }
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ flex: 1 }}
            />
            <Button onClick={() => void findByNumber()} disabled={loading}>
              Find
            </Button>
          </Stack>

          {recent.length > 0 && !source && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Recent invoices for this customer
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", gap: 1, mt: 0.5 }}
              >
                {recent.slice(0, 8).map((i) => (
                  <Chip
                    key={i.invoiceId}
                    label={`${i.number} · ${formatMoney(i.total)}`}
                    onClick={() => void load(i.invoiceId)}
                    size="small"
                  />
                ))}
              </Stack>
            </Box>
          )}

          {source && (
            <>
              <Divider />
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="subtitle2">
                  {source.number} · {source.clientName}
                </Typography>
                <Chip label={source.status} size="small" />
                <Button size="small" onClick={() => setSource(null)}>
                  Change
                </Button>
              </Stack>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Sold</TableCell>
                      <TableCell align="right">Returnable</TableCell>
                      <TableCell align="right" sx={{ width: 110 }}>
                        Returning
                      </TableCell>
                      <TableCell sx={{ width: 190 }}>Condition</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {source.lines.map((line) => (
                      <ReturnRow
                        key={line.lineItemId}
                        line={line}
                        entry={entries[line.lineItemId]}
                        onChange={(patch) => update(line.lineItemId, patch)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {chosen.length > 0 && (
                <Alert severity="info">
                  Crediting {formatMoney(refund.toFixed(2))} across{" "}
                  {chosen.length} line{chosen.length === 1 ? "" : "s"}.
                  {chosen.some(({ entry }) => !entry.restock) &&
                    " Anything marked write-off is refunded but does not go back on the shelf."}
                </Alert>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={saving || chosen.length === 0}
        >
          {saving ? "Adding…" : "Add return"}
        </Button>
      </DialogActions>
    </>
  );
}

function ReturnRow({
  line,
  entry,
  onChange,
}: {
  line: ReturnableLineDTO;
  entry: Entry | undefined;
  onChange: (patch: Partial<Entry>) => void;
}) {
  if (!entry) return null;
  const returnable = Number(line.quantityReturnable);
  const spent = returnable <= 0;
  const returning = Number(entry.quantity) > 0;
  // A perishable has to name the lot it is rejoining, or it becomes undated
  // stock that then sells ahead of everything with a known date.
  const needsExpiry = line.tracksExpiry && returning && !entry.expiryDate;

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Typography variant="body2">{line.description}</Typography>
          {Number(line.quantityReturned) > 0 && (
            <Typography variant="caption" color="text.secondary">
              {line.quantityReturned} already returned
            </Typography>
          )}
        </TableCell>
        <TableCell align="right">{line.quantitySold}</TableCell>
        <TableCell align="right">{line.quantityReturnable}</TableCell>
        <TableCell align="right">
          <TextField
            size="small"
            type="number"
            value={entry.quantity}
            disabled={spent}
            onChange={(e) => onChange({ quantity: e.target.value })}
            slotProps={{
              htmlInput: { min: 0, max: returnable, step: "0.001" },
            }}
            sx={{ width: 90 }}
          />
        </TableCell>
        <TableCell>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={entry.restock}
            disabled={spent || !returning}
            onChange={(_, v) => v !== null && onChange({ restock: v })}
          >
            <ToggleButton value={true}>Restock</ToggleButton>
            <ToggleButton value={false}>Write off</ToggleButton>
          </ToggleButtonGroup>
        </TableCell>
      </TableRow>
      {line.tracksExpiry && returning && (
        <TableRow>
          <TableCell colSpan={5} sx={{ pt: 0, borderBottom: 0 }}>
            <Stack direction="row" spacing={1} sx={{ pl: 2, pb: 1 }}>
              <TextField
                label="Lot"
                size="small"
                value={entry.lotNumber}
                onChange={(e) => onChange({ lotNumber: e.target.value })}
                sx={{ width: 180 }}
              />
              <TextField
                label="Expiry"
                size="small"
                type="date"
                required
                error={needsExpiry}
                helperText={
                  needsExpiry
                    ? "Needed: undated stock would be sold first"
                    : "From the pack, or the lot it was sold from"
                }
                value={entry.expiryDate}
                onChange={(e) => onChange({ expiryDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 220 }}
              />
            </Stack>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
