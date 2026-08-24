"use client";

import { useEffect, useState } from "react";
import {
  Alert,
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
import { apiRequest } from "@/utils/api-client";
import { CURRENCY, SECONDARY_CURRENCY } from "@/constants/clinic";
import { REGISTER_MAX_DAYS_BACK } from "@/constants/invoice";
import { formatDate, formatMoney, todayForDateInput } from "@/utils/format";
import type { RegisterDayDTO } from "@/types/entities";

interface Props {
  open: boolean;
  onClose: () => void;
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

interface Payout {
  id: number;
  description: string;
  amount: string;
  currency: string;
}

export default function RegisterCloseDialog({ open, onClose }: Props) {
  const [date, setDate] = useState(todayForDateInput());

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Close the register</DialogTitle>
      {/* Keyed on the day: the float, the payouts and the count all belong to
          one date, so switching days starts a fresh sheet rather than carrying
          yesterday's numbers into today's. */}
      <RegisterCloseBody
        key={date}
        date={date}
        onDateChange={setDate}
        onClose={onClose}
      />
    </Dialog>
  );
}

function RegisterCloseBody({
  date,
  onDateChange,
  onClose,
}: {
  date: string;
  onDateChange: (date: string) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<RegisterDayDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [openingUsd, setOpeningUsd] = useState("");
  const [openingLbp, setOpeningLbp] = useState("");
  const [countedUsd, setCountedUsd] = useState("");
  const [countedLbp, setCountedLbp] = useState("");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [nextPayoutId, setNextPayoutId] = useState(1);

  // One fetch per mount, and this body is remounted whenever the day changes.
  useEffect(() => {
    let cancelled = false;
    void apiRequest<{ register: RegisterDayDTO }>(
      `/api/invoices/register?date=${date}`,
    )
      .then((r) => {
        if (!cancelled) setData(r.register);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load this day");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const loading = !data && !error;

  function addPayout() {
    setPayouts((prev) => [
      ...prev,
      {
        id: nextPayoutId,
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

  return (
    <>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
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

          {error && <Alert severity="error">{error}</Alert>}

          {loading && (
            <Stack sx={{ alignItems: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Stack>
          )}

          {data && !loading && (
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
                  fullWidth
                />
                <TextField
                  label={`Opening ${SECONDARY_CURRENCY.code}`}
                  type="number"
                  value={openingLbp}
                  onChange={(e) => setOpeningLbp(e.target.value)}
                  slotProps={{ htmlInput: { step: "1000" } }}
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
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addPayout}
                >
                  Add
                </Button>
              </Stack>
              {payouts.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Anything taken out by hand: the owner drawing cash, rent paid
                  from the till, a supplier settled at the door.
                </Typography>
              )}
              {payouts.map((p) => (
                <Stack
                  key={p.id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <TextField
                    label="What for"
                    value={p.description}
                    onChange={(e) =>
                      updatePayout(p.id, { description: e.target.value })
                    }
                    size="small"
                    sx={{ flex: 2 }}
                  />
                  <TextField
                    label="Amount"
                    type="number"
                    value={p.amount}
                    onChange={(e) =>
                      updatePayout(p.id, { amount: e.target.value })
                    }
                    size="small"
                    slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
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
                    sx={{ minWidth: 96 }}
                  >
                    <MenuItem value={CURRENCY.code}>{CURRENCY.code}</MenuItem>
                    <MenuItem value={SECONDARY_CURRENCY.code}>
                      {SECONDARY_CURRENCY.code}
                    </MenuItem>
                  </TextField>
                  <IconButton
                    aria-label="Remove"
                    onClick={() =>
                      setPayouts((prev) => prev.filter((x) => x.id !== p.id))
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              ))}

              <Divider />
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
                  fullWidth
                />
                <TextField
                  label={`Counted ${SECONDARY_CURRENCY.code}`}
                  type="number"
                  value={countedLbp}
                  onChange={(e) => setCountedLbp(e.target.value)}
                  slotProps={{ htmlInput: { step: "1000" } }}
                  helperText={`at ${fxRate.toLocaleString("en-US")} / $1`}
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

              <Alert severity="info">
                This is a check, not a record. Nothing here is saved, so print
                or write down the sheet for {formatDate(date)} before closing
                it.
              </Alert>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </>
  );
}
