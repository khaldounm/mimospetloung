"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { useInvoiceScanner } from "@/hooks/useInvoiceScanner";
import type { InvoiceDTO } from "@/types/entities";
import type { ItemLineOption } from "./LineItemDialog";

interface Props {
  invoiceId: number;
  itemOptions: ItemLineOption[];
  onInvoiceUpdated: (invoice: InvoiceDTO) => void;
}

// True when the keystroke should be left alone because the user is typing
// somewhere real: another field, or anything inside an open dialog.
function typingElsewhere(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.closest("[role='dialog']")) return true;
  if (el.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

// Always-listening scan field for a draft invoice.
//
// Replaces opening a dialog, switching to the inventory tab, scanning, pressing
// Enter to resolve, then pressing Add, for every single product. A scan is an
// event: the code arrives, the line lands, the field is ready for the next one.
export default function ScanBar({
  invoiceId,
  itemOptions,
  onInvoiceUpdated,
}: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { submit, pending, feedback, unmatched, dismissUnmatched } =
    useInvoiceScanner(invoiceId, itemOptions, onInvoiceUpdated);

  // A hardware scanner is a keyboard: it types wherever the caret happens to
  // be. If someone clicked a line or the page background, the next scan would
  // be typed into nothing and silently lost, so printable keys pull focus back
  // here. Keys pressed inside another field or a dialog are left alone.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      if (typingElsewhere()) return;
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack spacing={1.5}>
        <TextField
          inputRef={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Scanners send Enter after the code. The field is cleared straight
            // away rather than after the request, so the next scan is never
            // typed on top of the last one.
            if (e.key !== "Enter") return;
            e.preventDefault();
            submit(value);
            setValue("");
          }}
          placeholder="Scan items"
          autoFocus
          fullWidth
          slotProps={{
            input: {
              sx: { fontSize: "1.25rem" },
              startAdornment: (
                <InputAdornment position="start">
                  <QrCodeScannerIcon />
                </InputAdornment>
              ),
            },
          }}
          helperText="Scan one after another, no need to click. Scanning the same product again adds one more. For a quantity, type 6* then scan."
        />

        {feedback && (
          <Alert
            key={feedback.at}
            severity={feedback.kind === "accepted" ? "success" : "error"}
            sx={{ py: 0.25 }}
          >
            {feedback.kind === "accepted" ? "Added " : ""}
            {feedback.message}
          </Alert>
        )}

        {pending.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {pending.map((s) => (
              <Chip
                key={s.id}
                size="small"
                variant="outlined"
                label={s.quantity === 1 ? s.label : `${s.label} x${s.quantity}`}
              />
            ))}
          </Stack>
        )}

        {unmatched.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Not recognised, scanning carried on:
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", gap: 1, mt: 0.5 }}
            >
              {unmatched.map((code) => (
                <Chip
                  key={code}
                  size="small"
                  color="error"
                  variant="outlined"
                  label={code}
                  onDelete={() => dismissUnmatched(code)}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
