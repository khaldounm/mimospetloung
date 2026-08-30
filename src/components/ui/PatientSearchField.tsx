"use client";

import { useState } from "react";
import { Autocomplete, Stack, TextField } from "@mui/material";
import {
  usePatientSearch,
  type PatientSearchResult,
} from "@/hooks/usePatientSearch";

interface Props {
  value: PatientSearchResult | null;
  onChange: (patient: PatientSearchResult | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  helperText?: string;
}

// Type-to-search pet picker, the sibling of ClientSearchField. Replaces the
// preloaded list this used to be: every pet in the clinic came down with the
// page to fill a dropdown inside a dialog most visits never open.
export default function PatientSearchField({
  value,
  onChange,
  label = "Patient",
  required,
  disabled,
  autoFocus,
  helperText,
}: Props) {
  const [input, setInput] = useState("");
  const { options, loading } = usePatientSearch(input);

  return (
    <Autocomplete
      options={options}
      value={value}
      loading={loading}
      disabled={disabled}
      onChange={(_e, v) => onChange(v)}
      onInputChange={(_e, v, reason) => {
        // Ignore the input change that fires when a selection populates the
        // box, otherwise picking a pet immediately re-searches its name.
        if (reason !== "reset") setInput(v);
      }}
      // The server already filtered; filtering again in the browser would hide
      // matches on the owner's name that the pet's label does not contain.
      filterOptions={(o) => o}
      getOptionLabel={(o) => o.label}
      // Keyed by id, not label: three pairs of pets share a name AND an owner,
      // so a label key collides and React may drop one of them from the list.
      getOptionKey={(o) => o.patientId}
      isOptionEqualToValue={(o, v) => o.patientId === v.patientId}
      renderOption={(props, o) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <li key={key} {...rest}>
            <Stack>
              <span>{o.label}</span>
              {o.species && (
                <span style={{ opacity: 0.6, fontSize: "0.8em" }}>
                  {o.species}
                </span>
              )}
            </Stack>
          </li>
        );
      }}
      noOptionsText={input.trim() ? "No matching pet" : "Type to search"}
      renderInput={(p) => (
        <TextField
          {...p}
          label={label}
          required={required}
          autoFocus={autoFocus}
          helperText={helperText ?? "Search by pet or owner name"}
        />
      )}
    />
  );
}
