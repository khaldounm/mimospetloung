"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import LockIcon from "@mui/icons-material/Lock";
import { apiRequest } from "@/utils/api-client";
import { CURRENCY, SECONDARY_CURRENCY } from "@/constants/clinic";
import { REGISTER_MAX_DAYS_BACK } from "@/constants/invoice";
import {
  RUNNING_COST_CATEGORIES,
  RUNNING_COST_ITEM_SUGGESTIONS,
} from "@/constants/running-cost";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  todayForDateInput,
} from "@/utils/format";
import type { RegisterClosingDTO, RegisterDayDTO } from "@/types/entities";

interface Props {
  open: boolean;
  onClose: () => void;
  // True when the user may file the count. Reading a day back is a wider grant
  // than closing one, so an owner checking the week can still be read-only.
  canClose: boolean;
}

// A cash figure in the currency it was counted in. Lira has no minor unit, so
// showing it with cents makes a drawer count harder to read, not more precise.
function formatCash(currency: string, value: number): string {
  if (currency === CURRENCY.code) return formatMoney(value);
  if (currency === SECONDARY_CURRENCY.code) {
    return `${SECONDARY_CURRENCY.symbol} ${Math.round(value).toLocaleString("en-US")}`;
  }
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Line({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
      <Typography
        color={muted ? "text.secondary" : undefined}
        sx={{ fontWeight: strong ? 600 : 400 }}
      >
        {label}
      </Typography>
      <Typography
        color={muted ? "text.secondary" : undefined}
        sx={{ fontWeight: strong ? 600 : 400 }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

// One handful of cash out of the till, entered exactly the way a running cost
// is: a category and an item. That is not a resemblance, it is the same thing.
// Money out of the drawer is an operating cost, and filing it under a category
// here is what puts it in the analytics breakdown beside the rent and the
// electricity instead of vanishing as an unexplained shortfall.
interface Payout {
  id: number;
  category: string;
  description: string;
  amount: string;
  currency: string;
}

// The day is fetched by the outer dialog so the body can initialise its state
// from a day that has already been closed, at mount, rather than syncing props
// into state through an effect afterwards.
export default function RegisterCloseDialog({
  open,
  onClose,
  canClose,
}: Props) {
  const [date, setDate] = useState(todayForDateInput());
  // Both carry the day they belong to rather than being cleared when the date
  // changes. Deriving "is this for the day on screen" is what keeps yesterday's
  // figures from flashing under today's heading while the new day loads, and it
  // means the effect only ever writes state from its own response.
  const [loaded, setLoaded] = useState<{
    date: string;
    day: RegisterDayDTO;
  } | null>(null);
  const [failed, setFailed] = useState<{
    date: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void apiRequest<{ register: RegisterDayDTO }>(
      `/api/invoices/register?date=${date}`,
    )
      .then((r) => {
        if (!cancelled) setLoaded({ date, day: r.register });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setFailed({
            date,
            message: e instanceof Error ? e.message : "Could not load this day",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, date]);

  const data = loaded?.date === date ? loaded.day : null;
  const error = failed?.date === date ? failed.message : null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Close the register</DialogTitle>
      {/* One body, which owns the single DialogContent. The day picker lives
          inside it rather than in a content box of its own: two stacked
          DialogContents each bring their own padding, and the seam between them
          landed a divider on top of the picker's helper text.

          Keyed on the day AND on whether that day is closed. Switching days
          starts a fresh sheet rather than carrying yesterday's numbers into
          today's, and a day that has just been saved comes back showing what
          was filed, both by remounting and reading the props at mount. */}
      <RegisterCloseBody
        key={`${date}-${data ? (data.closing?.closingId ?? "open") : "loading"}`}
        date={date}
        onDateChange={setDate}
        data={data}
        error={error}
        canClose={canClose}
        onSaved={(closing) =>
          setLoaded((l) =>
            l && l.date === date ? { ...l, day: { ...l.day, closing } } : l,
          )
        }
        onClose={onClose}
      />
    </Dialog>
  );
}

function RegisterCloseBody({
  date,
  onDateChange,
  data,
  error: loadError,
  canClose,
  onSaved,
  onClose,
}: {
  date: string;
  onDateChange: (date: string) => void;
  // Null while the day is still loading. The picker stays usable meanwhile, so
  // a slow day cannot trap someone on a date they did not want.
  data: RegisterDayDTO | null;
  error: string | null;
  canClose: boolean;
  onSaved: (closing: RegisterClosingDTO) => void;
  onClose: () => void;
}) {
  const closed = data?.closing ?? null;

  // Prefilled from the day's saved count when there is one, so reopening a
  // closed day shows what was filed rather than a blank sheet. Recounting it
  // then replaces the row instead of filing a second one.
  const [openingUsd, setOpeningUsd] = useState(closed?.openingUsd ?? "");
  const [openingLbp, setOpeningLbp] = useState(
    closed ? String(Number(closed.openingLbp)) : "",
  );
  const [countedUsd, setCountedUsd] = useState(closed?.countedUsd ?? "");
  const [countedLbp, setCountedLbp] = useState(
    closed ? String(Number(closed.countedLbp)) : "",
  );
  const [notes, setNotes] = useState(closed?.notes ?? "");
  const [payouts, setPayouts] = useState<Payout[]>(
    (closed?.payouts ?? []).map((p, i) => ({
      id: i + 1,
      category: p.category,
      description: p.description,
      amount: p.amount,
      currency: p.currency,
    })),
  );
  const [nextPayoutId, setNextPayoutId] = useState(
    (closed?.payouts.length ?? 0) + 1,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addPayout() {
    setPayouts((prev) => [
      ...prev,
      {
        id: nextPayoutId,
        category: "",
        description: "",
        amount: "",
        currency: CURRENCY.code,
      },
    ]);
    setNextPayoutId((n) => n + 1);
  }

  function updatePayout(id: number, patch: Partial<Payout>) {
    setPayouts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  const fxRate = data?.fxRate ?? 0;

  const opening: Record<string, number> = {
    [CURRENCY.code]: Number(openingUsd) || 0,
    [SECONDARY_CURRENCY.code]: Number(openingLbp) || 0,
  };
  const counted: Record<string, number> = {
    [CURRENCY.code]: Number(countedUsd) || 0,
    [SECONDARY_CURRENCY.code]: Number(countedLbp) || 0,
  };

  function paidOut(currency: string): number {
    return payouts
      .filter((p) => p.currency === currency)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  // Expected = what was in the drawer at the start, plus what the invoices say
  // came in, minus what was handed out of it. Per currency, because that is how
  // the notes are counted.
  const rows = (data?.currencies ?? []).map((line) => {
    const net = Number(line.net);
    const out = paidOut(line.currency);
    const expected = (opening[line.currency] ?? 0) + net - out;
    return {
      currency: line.currency,
      taken: Number(line.taken),
      refunded: Number(line.refunded),
      net,
      out,
      expected,
      counted: counted[line.currency] ?? 0,
      variance: (counted[line.currency] ?? 0) - expected,
    };
  });

  // One number for the whole drawer. A day that is short in dollars and over in
  // lira by the same value is a currency mix-up, not a loss, and only the
  // combined figure says so.
  const combinedVariance = rows.reduce(
    (sum, r) =>
      sum +
      (r.currency === SECONDARY_CURRENCY.code && fxRate > 0
        ? r.variance / fxRate
        : r.currency === CURRENCY.code
          ? r.variance
          : 0),
    0,
  );
  const nothingCounted = countedUsd.trim() === "" && countedLbp.trim() === "";
  // Anything under a cent is rounding in the lira conversion, not a discrepancy.
  const balances = Math.abs(combinedVariance) < 0.01;

  // Every draw needs both a category and a description, because that is what
  // makes it findable in the running costs later. A blank one is refused here
  // rather than filed as "Other / (no description)", which is the same as
  // losing it.
  const incompletePayout = payouts.some(
    (p) =>
      !p.category.trim() || !p.description.trim() || !(Number(p.amount) > 0),
  );

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiRequest<{ closing: RegisterClosingDTO }>(
        "/api/invoices/register",
        {
          method: "POST",
          body: {
            // Safe to take from the picker: this body only ever renders a
            // save button once `data` has loaded, and `data` is non-null only
            // while it belongs to this same date. See the outer component.
            date,
            openingUsd,
            openingLbp,
            countedUsd,
            countedLbp,
            notes,
            payouts: payouts.map((p) => ({
              category: p.category.trim(),
              description: p.description.trim(),
              amount: p.amount,
              currency: p.currency,
            })),
          },
        },
      );
      onSaved(res.closing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the count");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Day"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: {
                min: daysAgo(REGISTER_MAX_DAYS_BACK),
                max: todayForDateInput(),
              },
            }}
            helperText={`Today or any of the last ${REGISTER_MAX_DAYS_BACK} days`}
            fullWidth
          />

          {loadError && <Alert severity="error">{loadError}</Alert>}

          {!data && !loadError && (
            <Stack sx={{ alignItems: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          )}

          {closed && (
            <Alert severity="success" icon={<LockIcon />}>
              Closed by {closed.closedByName ?? "someone"} on{" "}
              {formatDateTime(closed.closedAt)}.
              {canClose
                ? " Counting it again replaces what was filed."
                : " You can read it here but not change it."}
            </Alert>
          )}

          {data && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                In the drawer at the start
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label={`Opening ${CURRENCY.code}`}
                  type="number"
                  value={openingUsd}
                  onChange={(e) => setOpeningUsd(e.target.value)}
                  slotProps={{ htmlInput: { step: "0.01" } }}
                  disabled={!canClose}
                  fullWidth
                />
                <TextField
                  label={`Opening ${SECONDARY_CURRENCY.code}`}
                  type="number"
                  value={openingLbp}
                  onChange={(e) => setOpeningLbp(e.target.value)}
                  slotProps={{ htmlInput: { step: "1000" } }}
                  disabled={!canClose}
                  fullWidth
                />
              </Stack>

              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                Money in, from the invoices
              </Typography>
              {rows.map((r) => (
                <Stack key={`in-${r.currency}`} spacing={0.5}>
                  <Line
                    label={`Taken in ${r.currency}`}
                    value={formatCash(r.currency, r.taken)}
                  />
                  {r.refunded > 0 && (
                    <Line
                      label="Refunded to customers"
                      value={`- ${formatCash(r.currency, r.refunded)}`}
                      muted
                    />
                  )}
                  <Line
                    label={`Net ${r.currency}`}
                    value={formatCash(r.currency, r.net)}
                    strong
                  />
                </Stack>
              ))}
              {data.unspecifiedCount > 0 && (
                <Alert severity="info">
                  {data.unspecifiedCount} payment
                  {data.unspecifiedCount === 1 ? "" : "s"} (
                  {formatMoney(data.unspecifiedUsd)}) had no method recorded and
                  {data.unspecifiedCount === 1 ? " was" : " were"} counted as
                  cash.
                </Alert>
              )}
              {data.nonCash.length > 0 && (
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Not in the drawer
                  </Typography>
                  {data.nonCash.map((n) => (
                    <Line
                      key={n.method}
                      label={`${n.method} (${n.count})`}
                      value={formatMoney(n.amountUsd)}
                      muted
                    />
                  ))}
                </Stack>
              )}

              <Divider />
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  Money out of the drawer
                </Typography>
                {canClose && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addPayout}
                  >
                    Add
                  </Button>
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Anything taken out by hand: the owner drawing cash, rent paid
                from the till, a supplier settled at the door. Each one is filed
                as a running cost under the category you pick, so it shows up in
                analytics with the rest of the clinic&rsquo;s costs.
              </Typography>
              {payouts.map((p) => (
                <Stack key={p.id} spacing={1}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    {/* The same two fields the running-cost form uses, with the
                    same suggestions, so a draw files itself into the categories
                    the clinic already reads its costs by. */}
                    <Autocomplete
                      freeSolo
                      options={
                        RUNNING_COST_CATEGORIES as readonly string[] as string[]
                      }
                      value={p.category}
                      onChange={(_e, v) =>
                        updatePayout(p.id, { category: v ?? "" })
                      }
                      inputValue={p.category}
                      onInputChange={(_e, v) =>
                        updatePayout(p.id, { category: v })
                      }
                      disabled={!canClose}
                      size="small"
                      sx={{ flex: 1 }}
                      renderInput={(params) => (
                        <TextField {...params} label="Category" required />
                      )}
                    />
                    <Autocomplete
                      freeSolo
                      options={RUNNING_COST_ITEM_SUGGESTIONS[p.category] ?? []}
                      value={p.description}
                      onChange={(_e, v) =>
                        updatePayout(p.id, { description: v ?? "" })
                      }
                      inputValue={p.description}
                      onInputChange={(_e, v) =>
                        updatePayout(p.id, { description: v })
                      }
                      disabled={!canClose}
                      size="small"
                      sx={{ flex: 1 }}
                      renderInput={(params) => (
                        <TextField {...params} label="What for" required />
                      )}
                    />
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <TextField
                      label="Amount"
                      type="number"
                      value={p.amount}
                      onChange={(e) =>
                        updatePayout(p.id, { amount: e.target.value })
                      }
                      size="small"
                      slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                      disabled={!canClose}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      select
                      label="Currency"
                      value={p.currency}
                      onChange={(e) =>
                        updatePayout(p.id, { currency: e.target.value })
                      }
                      size="small"
                      disabled={!canClose}
                      sx={{ minWidth: 96 }}
                    >
                      <MenuItem value={CURRENCY.code}>{CURRENCY.code}</MenuItem>
                      <MenuItem value={SECONDARY_CURRENCY.code}>
                        {SECONDARY_CURRENCY.code}
                      </MenuItem>
                    </TextField>
                    {canClose && (
                      <IconButton
                        aria-label="Remove"
                        onClick={() =>
                          setPayouts((prev) =>
                            prev.filter((x) => x.id !== p.id),
                          )
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Stack>
                  <Divider />
                </Stack>
              ))}

              <Typography variant="subtitle2" color="text.secondary">
                Counted in the drawer now
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label={`Counted ${CURRENCY.code}`}
                  type="number"
                  value={countedUsd}
                  onChange={(e) => setCountedUsd(e.target.value)}
                  slotProps={{ htmlInput: { step: "0.01" } }}
                  disabled={!canClose}
                  fullWidth
                />
                <TextField
                  label={`Counted ${SECONDARY_CURRENCY.code}`}
                  type="number"
                  value={countedLbp}
                  onChange={(e) => setCountedLbp(e.target.value)}
                  slotProps={{ htmlInput: { step: "1000" } }}
                  helperText={`at ${fxRate.toLocaleString("en-US")} / $1`}
                  disabled={!canClose}
                  fullWidth
                />
              </Stack>

              <Divider />
              <Box>
                {rows.map((r) => (
                  <Stack key={`out-${r.currency}`} spacing={0.5} sx={{ mb: 1 }}>
                    <Line
                      label={`Expected ${r.currency}`}
                      value={formatCash(r.currency, r.expected)}
                      strong
                    />
                    <Line
                      label="Counted"
                      value={formatCash(r.currency, r.counted)}
                    />
                    <Line
                      label="Difference"
                      value={formatCash(r.currency, r.variance)}
                      muted
                    />
                  </Stack>
                ))}
                <Divider sx={{ my: 1 }} />
                {nothingCounted ? (
                  <Typography color="text.secondary">
                    Enter what you counted to see whether the day works out.
                  </Typography>
                ) : (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Chip
                      color={balances ? "success" : "error"}
                      label={
                        balances
                          ? "The register works out"
                          : combinedVariance > 0
                            ? `Over by ${formatMoney(combinedVariance)}`
                            : `Short by ${formatMoney(Math.abs(combinedVariance))}`
                      }
                    />
                    <Typography variant="caption" color="text.secondary">
                      both currencies together, at{" "}
                      {fxRate.toLocaleString("en-US")} / $1
                    </Typography>
                  </Stack>
                )}
              </Box>

              <TextField
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the next person should know about this day"
                multiline
                minRows={2}
                disabled={!canClose}
                fullWidth
              />

              {error && <Alert severity="error">{error}</Alert>}

              {/* A short drawer is still a real day and still has to be filed. The
              count is the record of what was actually there, not a claim that
              it was right, so being out is a warning and never a block. */}
              {!nothingCounted && !balances && canClose && (
                <Alert severity="warning">
                  This day does not balance. Save it anyway if that is what was
                  in the drawer, and put what you know in the notes.
                </Alert>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Close
        </Button>
        {canClose && data && (
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={saving || nothingCounted || incompletePayout}
          >
            {saving
              ? "Saving…"
              : closed
                ? `Save the count for ${formatDate(data.date)}`
                : `Close ${formatDate(data.date)}`}
          </Button>
        )}
      </DialogActions>
    </>
  );
}
