"use client";

import { InputAdornment, Stack, TextField } from "@mui/material";

// The pair of vitals taken at a visit, shared by the add and edit dialogs so
// the two can never drift apart on units, step or placeholder.
//
// Values are held as strings, like every other field in these forms: an empty
// string is "not taken", which the API turns into null. Typing them as numbers
// here would make a cleared field indistinguishable from a zero.
export default function VitalsFields({
  temperature,
  weight,
  onTemperatureChange,
  onWeightChange,
}: {
  temperature: string;
  weight: string;
  onTemperatureChange: (value: string) => void;
  onWeightChange: (value: string) => void;
}) {
  return (
    <Stack direction="row" spacing={2}>
      <TextField
        label="Temperature"
        type="number"
        value={temperature}
        onChange={(e) => onTemperatureChange(e.target.value)}
        slotProps={{
          htmlInput: { min: 20, max: 50, step: "0.1" },
          input: {
            endAdornment: <InputAdornment position="end">°C</InputAdornment>,
          },
        }}
        fullWidth
        helperText="Leave blank if not taken"
      />
      <TextField
        label="Weight"
        type="number"
        value={weight}
        onChange={(e) => onWeightChange(e.target.value)}
        slotProps={{
          htmlInput: { min: 0.01, max: 999.99, step: "0.01" },
          input: {
            endAdornment: <InputAdornment position="end">kg</InputAdornment>,
          },
        }}
        fullWidth
        helperText="Leave blank if not weighed"
      />
    </Stack>
  );
}
