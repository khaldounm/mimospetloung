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

// A scanner types a barcode far faster than any hand: consecutive characters
// land a few milliseconds apart. Anything slower than this between two keys is
// treated as a person typing, and that buffer will wait for Enter.
const MAX_SCANNER_KEY_GAP_MS = 35;

// How long the buffer has to stay still before a machine-typed burst is taken
// as complete. Long enough to outlast the gaps inside a real scan, short enough
// that the line appears while the next product is being lined up.
const SCANNER_QUIET_MS = 90;

// How many consecutive machine-speed keystrokes count as a scan. No hand types
// six characters this fast and no real barcode is shorter, so this separates a
// scanner from a person without ever cutting someone off mid-entry.
const MIN_AUTO_SUBMIT_LENGTH = 6;

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

  // Timing of the keystrokes making up the current buffer, used to tell a
  // scanner burst from someone typing. See the auto-submit note below.
  const lastKeyAt = useRef(0);
  const fastRun = useRef(0);
  const bufferLength = useRef(0);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fire(code: string) {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = null;
    fastRun.current = 0;
    bufferLength.current = 0;
    submit(code);
    setValue("");
  }

  // Most scanners are configured to send Enter after the code, but not all
  // are, and the setting lives on the scanner rather than in this app. Rather
  // than depend on it, watch how the characters arrive: a scanner emits a whole
  // barcode in a few milliseconds per key and then stops, which no human hand
  // does. A burst that came in at machine speed and has gone quiet is submitted
  // on its own. Anything typed by hand still waits for Enter, so a person
  // half-way through a code is never cut off mid-entry.
  function handleChange(next: string) {
    const now = Date.now();
    const gap = now - lastKeyAt.current;
    const grew = next.length > bufferLength.current;
    lastKeyAt.current = now;
    bufferLength.current = next.length;

    // Count the current run of machine-speed keystrokes rather than judging the
    // whole buffer. That matters for the quantity prefix: "6*" is typed by
    // hand, and a whole-buffer test would write the scan off as human because
    // of those two slow keys. Only the run itself has to look like a scanner.
    if (!grew) {
      fastRun.current = 0;
    } else if (gap <= MAX_SCANNER_KEY_GAP_MS) {
      fastRun.current += 1;
    } else {
      fastRun.current = 1;
    }

    setValue(next);

    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      if (fastRun.current >= MIN_AUTO_SUBMIT_LENGTH) fire(next);
    }, SCANNER_QUIET_MS);
  }

  useEffect(() => {
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, []);

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
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            // A scanner that does send Enter is taken at its word, without
            // waiting out the quiet period. The field is cleared straight away
            // rather than after the request, so the next scan is never typed on
            // top of the last one.
            if (e.key !== "Enter") return;
            e.preventDefault();
            fire(value);
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
          helperText="Scan one after another, no need to click or press Enter. Scanning the same product again adds one more. For a quantity, type 6* then scan."
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
