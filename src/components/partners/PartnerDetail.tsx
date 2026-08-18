"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import PaymentsIcon from "@mui/icons-material/Payments";
import DeleteIcon from "@mui/icons-material/Delete";
import { apiRequest } from "@/utils/api-client";
import { formatDate, formatDateTime, formatMoney } from "@/utils/format";
import { rangeEndLabel, rangeQuery, rangeSummary } from "@/utils/date-range";
import StatCard from "@/components/ui/StatCard";
import DateRangeControl from "@/components/ui/DateRangeControl";
import type {
  AnalyticsRange,
  PartnerDTO,
  PartnerEarningDTO,
  PartnerItemPerformanceDTO,
  PartnerPayoutDTO,
} from "@/types/entities";
import PartnerFormDialog from "./PartnerFormDialog";
import PartnerPayoutFormDialog from "./PartnerPayoutFormDialog";
import PartnerGlossary from "./PartnerGlossary";
import OwedBreakdownCard from "./OwedBreakdownCard";

interface Props {
  partner: PartnerDTO;
  itemPerformance: PartnerItemPerformanceDTO[];
  earnings: PartnerEarningDTO[];
  payouts: PartnerPayoutDTO[];
  initialRange: AnalyticsRange;
  canWrite: boolean;
}

interface DetailResponse {
  partner: PartnerDTO;
  itemPerformance: PartnerItemPerformanceDTO[];
  earnings: PartnerEarningDTO[];
  payouts: PartnerPayoutDTO[];
}

export default function PartnerDetail({
  partner: initialPartner,
  itemPerformance: initialItemPerformance,
  earnings,
  payouts,
  initialRange,
  canWrite,
}: Props) {
  const router = useRouter();
  const [partner, setPartner] = useState(initialPartner);
  const [itemPerformance, setItemPerformance] = useState(
    initialItemPerformance,
  );
  const [range, setRange] = useState(initialRange);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const latest = useRef(0);

  const money = partner.money;
  const period = rangeSummary(range).toLowerCase();
  const asOf = rangeEndLabel(range);

  // Only the range-scoped figures are refetched. The earnings and payout ledgers
  // below are full history on purpose, so they stay as server-rendered.
  function changeRange(next: AnalyticsRange) {
    setRange(next);
    const requestId = ++latest.current;
    setLoading(true);
    setError(null);

    const query = rangeQuery(next);
    // Keep the URL in step so a reload, or a back into this page, stays on the
    // period being read. See the note in PartnersTable on replaceState.
    window.history.replaceState(null, "", `?${query}`);

    apiRequest<DetailResponse>(`/api/partners/${partner.partnerId}?${query}`)
      .then((res) => {
        if (requestId !== latest.current) return;
        setPartner(res.partner);
        setItemPerformance(res.itemPerformance);
      })
      .catch((err: unknown) => {
        if (requestId === latest.current) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (requestId === latest.current) setLoading(false);
      });
  }

  async function deletePayout(payout: PartnerPayoutDTO) {
    if (!window.confirm(`Delete the ${formatMoney(payout.amount)} payout?`)) {
      return;
    }
    await apiRequest(
      `/api/partners/${partner.partnerId}/payouts/${payout.payoutId}`,
      { method: "DELETE" },
    );
    // Refetch for the range we are on as well as refreshing the server render.
    // The figures above live in state (the range picker needs them to), and
    // router.refresh() alone only replaces props, so the cards would keep
    // showing the balance from before the payout was removed.
    changeRange(range);
    router.refresh();
  }

  const sellThrough = Number(money?.sellThroughPct ?? 0);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography variant="h4">{partner.name}</Typography>
            {!partner.isActive && <Chip label="Inactive" />}
          </Stack>
          <Typography color="text.secondary">
            {partner.defaultSharePct}% default profit share
            {partner.phone ? ` · ${partner.phone}` : ""}
          </Typography>
        </Box>
        {canWrite && (
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<PaymentsIcon />}
              onClick={() => setPayoutOpen(true)}
            >
              Record payout
            </Button>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
          </Stack>
        )}
      </Stack>

      <PartnerGlossary />

      <Box sx={{ mb: 2 }}>
        <DateRangeControl
          range={range}
          onChange={changeRange}
          disabled={loading}
        />
      </Box>
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography variant="overline" color="text.secondary">
        Performance ({period})
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          mb: 2,
          mt: 0.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(4, 1fr)",
          },
        }}
      >
        <StatCard
          label="Revenue"
          value={formatMoney(money?.revenue)}
          hint={`${money?.unitsSold ?? 0} units sold`}
        />
        <StatCard
          label="Cost of sales"
          value={formatMoney(money?.costOfSales)}
          hint="Their capital, coming back"
        />
        <StatCard
          label="Gross profit"
          value={formatMoney(money?.grossProfit)}
          hint="Revenue minus cost"
        />
        <StatCard
          label="Split"
          value={`${formatMoney(money?.partnerShare)} / ${formatMoney(money?.clinicShare)}`}
          hint="Theirs / clinic's"
          accent={Number(money?.clinicShare ?? 0) < 0 ? "error" : "success"}
        />
      </Box>

      <Typography variant="overline" color="text.secondary">
        Position (as at {asOf})
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          mb: 2,
          mt: 0.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(4, 1fr)",
          },
        }}
      >
        <StatCard
          label="Capital deployed"
          value={formatMoney(money?.capitalDeployed)}
          accent="info"
          hint={`Their money in, up to ${asOf}`}
        />
        <StatCard
          label="Recovered by sales"
          value={formatMoney(money?.capitalRecoveredToDate)}
          hint="Of that, freed up by selling"
        />
        <StatCard
          label="Still in stock"
          value={formatMoney(money?.capitalOnShelf)}
          hint="Of that, not yet sold"
        />
        <OwedBreakdownCard
          balance={money?.balance}
          capitalOwed={money?.capitalOwed}
          profitOwed={money?.profitOwed}
          profitShareToDate={money?.profitShareToDate}
          asOf={asOf}
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body2">Sell-through</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {sellThrough}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, Math.max(0, sellThrough))}
          sx={{ height: 8, borderRadius: 1 }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
        >
          Share of everything this partner had funded as at {asOf} that had come
          back through sales. The rest was still sitting in stock.
        </Typography>
      </Paper>

      <Typography variant="h5" sx={{ mb: 0.5 }}>
        By item
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        How each of their lines performed over {period}. A line showing nothing
        sold moved no stock in these dates, which is not the same as idle
        capital: its sales may simply fall outside them.
      </Typography>

      {/* The figures above are all zero whenever the range happens to miss this
          partner's activity, which reads exactly like "nothing ever sold". The
          ledger below is full history, so it can say when the last sale actually
          was and point at the range as the reason. */}
      {Number(money?.unitsSold ?? 0) === 0 && earnings.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nothing sold in {period}. Their most recent movement was{" "}
          {formatDateTime(earnings[0].performedAt)}, so widen the dates to see
          it.
        </Alert>
      )}
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">In stock</TableCell>
              <TableCell align="right">Capital held</TableCell>
              <TableCell align="right">Sold</TableCell>
              <TableCell align="right">Revenue</TableCell>
              <TableCell align="right">Cost</TableCell>
              <TableCell align="right">Gross profit</TableCell>
              <TableCell align="right">Their share</TableCell>
              <TableCell align="right">Clinic share</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {itemPerformance.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No items are sourced from this partner yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              itemPerformance.map((row) => {
                const idle = Number(row.unitsSold) === 0;
                return (
                  <TableRow key={row.itemId} hover>
                    <TableCell>
                      <Link href={`/inventory/${row.itemId}`}>
                        {row.itemName}
                      </Link>
                      {row.unit && (
                        <Typography variant="caption" color="text.secondary">
                          {` (${row.unit})`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{row.currentStock}</TableCell>
                    <TableCell align="right">
                      {formatMoney(row.capitalOnShelf)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: idle ? "text.disabled" : undefined }}
                    >
                      {row.unitsSold}
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(row.revenue)}
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(row.costOfSales)}
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(row.grossProfit)}
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(row.partnerShare)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          Number(row.clinicShare) < 0
                            ? "error.main"
                            : undefined,
                      }}
                    >
                      {formatMoney(row.clinicShare)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h5" sx={{ mb: 0.5 }}>
        Every sale
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Full history, not affected by the date range. Owed is capital plus their
        share for that sale.
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Invoice</TableCell>
              <TableCell>Item</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Owed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {earnings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No sales yet. Owed amounts accrue as this partner&apos;s
                    items are sold on issued invoices.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              earnings.map((e) => (
                <TableRow key={e.transactionId} hover>
                  <TableCell>{formatDateTime(e.performedAt)}</TableCell>
                  <TableCell>
                    {e.invoiceNumber ?? "-"}
                    {e.type !== "Sold" ? " (void)" : ""}
                  </TableCell>
                  <TableCell>{e.itemName}</TableCell>
                  <TableCell align="right">
                    {Math.abs(Number(e.quantity))}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: Number(e.payable) < 0 ? "error.main" : undefined,
                    }}
                  >
                    {formatMoney(e.payable)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h5" sx={{ mb: 2 }}>
        Payouts
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Added by</TableCell>
              {canWrite && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {payouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 6 : 5} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No payouts recorded yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              payouts.map((p) => (
                <TableRow key={p.payoutId} hover>
                  <TableCell>{formatDate(p.paidOn)}</TableCell>
                  <TableCell align="right">{formatMoney(p.amount)}</TableCell>
                  <TableCell>{p.method ?? "-"}</TableCell>
                  <TableCell>{p.reference ?? "-"}</TableCell>
                  <TableCell>{p.createdByName ?? "-"}</TableCell>
                  {canWrite && (
                    <TableCell align="right">
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => void deletePayout(p)}
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
        </Table>
      </TableContainer>

      <PartnerFormDialog
        open={editOpen}
        partner={partner}
        onClose={() => setEditOpen(false)}
        onSaved={() => router.refresh()}
      />
      <PartnerPayoutFormDialog
        open={payoutOpen}
        partnerId={partner.partnerId}
        partnerName={partner.name}
        balance={money?.balance ?? "0"}
        onClose={() => setPayoutOpen(false)}
        onSaved={() => router.refresh()}
      />
    </Box>
  );
}
