"use client";

import {
  Box,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { DATE_PRESETS, matchPreset, resolvePreset } from "@/utils/date-range";
import type { AnalyticsRange } from "@/types/entities";

interface Props {
  range: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
  disabled?: boolean;
}

// Reusable from/to calendar with quick presets (Today, This month, ...). The
// active preset highlights when the current range matches one; editing a date
// directly just leaves them all unselected (a custom range).
export default function DateRangeControl({ range, onChange, disabled }: Props) {
  const activePreset = matchPreset(range);

  function pickPreset(id: string | null) {
    if (!id) return; // ignore de-selecting the active preset
    const next = resolvePreset(id);
    if (next) onChange(next);
  }

  // Keep from <= to when either side is edited by hand.
  function editFrom(from: string) {
    onChange({ from, to: from > range.to ? from : range.to });
  }
  function editTo(to: string) {
    onChange({ from: to < range.from ? to : range.from, to });
  }

  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ flexWrap: "wrap", alignItems: "center", gap: 1.5 }}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={activePreset}
        onChange={(_, id: string | null) => pickPreset(id)}
        disabled={disabled}
        sx={{ flexWrap: "wrap" }}
      >
        {DATE_PRESETS.map((p) => (
          <ToggleButton key={p.id} value={p.id} sx={{ textTransform: "none" }}>
            {p.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box sx={{ flexGrow: 1 }} />

      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <TextField
          label="From"
          type="date"
          size="small"
          value={range.from}
          onChange={(e) => editFrom(e.target.value)}
          disabled={disabled}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { max: range.to },
          }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={range.to}
          onChange={(e) => editTo(e.target.value)}
          disabled={disabled}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { min: range.from },
          }}
        />
      </Stack>
    </Stack>
  );
}
