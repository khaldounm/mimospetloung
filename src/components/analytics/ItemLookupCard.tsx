"use client";

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Chip,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useItemPerformance } from "@/hooks/useItemPerformance";
import { useItemSearch } from "@/hooks/useItemSearch";
import { formatDate, formatQty } from "@/utils/format";
import { ChartCard, money } from "./AnalyticsPrimitives";
import type { AnalyticsRange, ItemSearchResult } from "@/types/entities";

// One label/value line in the figures list. A plain two-column row rather than a
// table: the card is half the grid wide, and a table here would wrap badly the
// moment an item has a long name.
function Figure({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "error";
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        color={emphasis === "error" ? "error.main" : undefined}
        sx={{ fontWeight: 600, flexShrink: 0 }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

// Look up one product and see how it traded over the dates the section is set
// to. Sits beside the leaderboard because it answers the question the
// leaderboard provokes: fine, but how did *this* one do?
export default function ItemLookupCard({ range }: { range: AnalyticsRange }) {
  const [selected, setSelected] = useState<ItemSearchResult | null>(null);
  const [input, setInput] = useState("");
  const { options, loading: searching } = useItemSearch(input);
  const {
    data: item,
    loading,
    error,
  } = useItemPerformance(selected?.itemId ?? null, range);

  return (
    <ChartCard title="Item performance">
      <Autocomplete
        size="small"
        options={options}
        value={selected}
        loading={searching}
        onChange={(_e, v) => setSelected(v)}
        onInputChange={(_e, v, reason) => {
          // Ignore the input change that fires when a selection fills the box,
          // otherwise picking an item immediately re-searches its own name.
          if (reason !== "reset") setInput(v);
        }}
        // The server already matched on name, category and barcode. Filtering
        // again here would hide a hit whose barcode the typed text is not in.
        filterOptions={(o) => o}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(o, v) => o.itemId === v.itemId}
        renderOption={(props, o) => {
          const { key, ...rest } = props as typeof props & { key: string };
          return (
            <li key={key} {...rest}>
              <Stack>
                <span>{o.name}</span>
                <span style={{ opacity: 0.6, fontSize: "0.8em" }}>
                  {[o.category, o.barcode].filter(Boolean).join(" · ")}
                </span>
              </Stack>
            </li>
          );
        }}
        noOptionsText={input.trim() ? "No matching item" : "Type to search"}
        renderInput={(p) => (
          <TextField
            {...p}
            label="Search a product or scan a barcode"
            placeholder="Name or barcode"
          />
        )}
      />

      <Box sx={{ mt: 2 }}>
        {!selected && (
          <Typography variant="body2" color="text.secondary">
            Pick a product to see what it sold, what came back and what it
            billed over these dates.
          </Typography>
        )}
        {loading && <LinearProgress sx={{ borderRadius: 1 }} />}
        {error && <Alert severity="error">{error}</Alert>}
        {item && (
          <Stack spacing={1}>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ flexWrap: "wrap", gap: 0.5, mb: 0.5 }}
            >
              {item.category && (
                <Chip size="small" variant="outlined" label={item.category} />
              )}
              {item.barcode && (
                <Chip size="small" variant="outlined" label={item.barcode} />
              )}
            </Stack>
            <Figure label="Units sold" value={formatQty(item.unitsSold)} />
            <Figure
              label="Units returned"
              value={formatQty(item.unitsReturned)}
              emphasis={item.unitsReturned > 0 ? "error" : undefined}
            />
            <Figure
              label="Net units"
              value={formatQty(item.netUnits, item.unit)}
            />
            <Figure label="Net billed" value={money(item.netRevenue)} />
            <Figure
              label="Return rate"
              value={item.returnRate === null ? "-" : `${item.returnRate}%`}
            />
            <Figure
              label="Sold on"
              value={`${item.invoiceCount} invoice${
                item.invoiceCount === 1 ? "" : "s"
              }, ${item.clientCount} client${item.clientCount === 1 ? "" : "s"}`}
            />
            <Figure
              label="Average price per unit"
              value={
                item.avgUnitPrice === null ? "-" : money(item.avgUnitPrice)
              }
            />
            <Figure
              label="Last sold"
              value={item.lastSoldAt ? formatDate(item.lastSoldAt) : "-"}
            />
            <Figure
              label="Stock now"
              value={formatQty(item.currentStock, item.unit)}
            />
          </Stack>
        )}
      </Box>
    </ChartCard>
  );
}
