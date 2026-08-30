"use client";

import { useState } from "react";
import { Autocomplete, Chip, Stack, TextField } from "@mui/material";
import { useClientBalance } from "@/hooks/useClientBalance";
import {
  useClientSearch,
  type ClientSearchResult,
} from "@/hooks/useClientSearch";
import { formatAccountBalance } from "@/utils/format";

interface Props {
  value: ClientSearchResult | null;
  onChange: (client: ClientSearchResult | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  helperText?: string;
  // Shows what the selected client owes (or is in credit) under the field.
  showBalance?: boolean;
}

// Type-to-search client picker. Replaces the plain select this used to be: that
// rendered whatever /api/clients returned, which is page one of 25 out of ~1,900
// clients, so most of the list was simply unreachable.
export default function ClientSearchField({
  value,
  onChange,
  label = "Client",
  required,
  disabled,
  autoFocus,
  helperText,
  showBalance,
}: Props) {
  const [input, setInput] = useState("");
  const { options, loading } = useClientSearch(input);
  const balance = useClientBalance(
    showBalance ? (value?.clientId ?? null) : null,
  );
  const summary = balance != null ? formatAccountBalance(balance) : null;

  return (
    <Stack spacing={1}>
      <Autocomplete
        options={options}
        value={value}
        loading={loading}
        disabled={disabled}
        onChange={(_e, v) => onChange(v)}
        onInputChange={(_e, v, reason) => {
          // Ignore the input change that fires when a selection populates the
          // box, otherwise picking a client immediately re-searches their name.
          if (reason !== "reset") setInput(v);
        }}
        // The server already filtered; filtering again in the browser would
        // hide matches on phone or email that the input text does not contain.
        filterOptions={(o) => o}
        getOptionLabel={(o) => o.label}
        // Without this the list is keyed by the label, and two clients really do
        // share a name: the file has six such pairs, so React saw two children
        // keyed "Ramzi Merhi" and was free to drop one of them from the list.
        getOptionKey={(o) => o.clientId}
        isOptionEqualToValue={(o, v) => o.clientId === v.clientId}
        renderOption={(props, o) => {
          const { key, ...rest } = props as typeof props & { key: string };
          return (
            <li key={key} {...rest}>
              <Stack>
                <span>{o.label}</span>
                {o.phone && (
                  <span style={{ opacity: 0.6, fontSize: "0.8em" }}>
                    {o.phone}
                  </span>
                )}
              </Stack>
            </li>
          );
        }}
        noOptionsText={input.trim() ? "No matching client" : "Type to search"}
        renderInput={(p) => (
          <TextField
            {...p}
            label={label}
            required={required}
            autoFocus={autoFocus}
            helperText={helperText ?? "Search by name, phone or email"}
          />
        )}
      />
      {showBalance && summary && (
        <Chip
          size="small"
          variant="outlined"
          color={summary.owes ? "warning" : "default"}
          label={summary.text}
          sx={{ alignSelf: "flex-start" }}
        />
      )}
    </Stack>
  );
}
