"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { useInvoiceScanner } from "@/hooks/useInvoiceScanner";
import { formatMoney } from "@/utils/format";
import {
  buildLineSearchIndex,
  searchLines,
  type LineSearchResult,
} from "@/utils/line-search";
import type { InvoiceDTO } from "@/types/entities";
import type { ItemLineOption, ServiceLineOption } from "./LineItemDialog";

interface Props {
  invoiceId: number;
  itemOptions: ItemLineOption[];
  serviceOptions: ServiceLineOption[];
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

// Shortest thing worth searching on. One character matches most of a catalogue
// and tells the counter nothing.
const MIN_SEARCH_LENGTH = 2;

// A screenful. Enough that the right answer is nearly always visible, few
// enough that it is read rather than scrolled.
const MAX_SUGGESTIONS = 8;

// A quantity typed before the product, the same "6*" prefix a scan takes.
const MULTIPLIER = /^(\d{1,4})\s*\*\s*(.*)$/;

// What is being typed: a barcode, or a product name.
//
// A barcode is all digits and arrives at machine speed; a name has letters in
// it. Splitting on that means the search list never appears mid-scan, and a
// scanner burst is never mistaken for someone looking something up. A buffer
// that is still all digits stays a barcode, because that is what it will be
// nine times out of ten.
function looksLikeSearch(text: string): boolean {
  const body = MULTIPLIER.exec(text)?.[2] ?? text;
  return body.trim().length >= MIN_SEARCH_LENGTH && /\D/.test(body);
}

// The quantity prefix and the rest, for a buffer being searched on.
function splitQuery(text: string): { quantity: number; query: string } {
  const parts = MULTIPLIER.exec(text);
  return {
    quantity: parts ? Number(parts[1]) : 1,
    query: parts ? (parts[2] ?? "").trim() : text.trim(),
  };
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
  serviceOptions,
  onInvoiceUpdated,
}: Props) {
  const [value, setValue] = useState("");
  // Which suggestion the arrow keys are on. -1 means none, and Enter then falls
  // through to the barcode path, so a scan can never be hijacked by a list that
  // happens to be open.
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { submit, add, pending, feedback, unmatched, dismissUnmatched } =
    useInvoiceScanner(invoiceId, itemOptions, onInvoiceUpdated);

  // Built once from the options the page already shipped. No request is made
  // while typing, which is the point: a search endpoint called per keystroke
  // puts a round trip between the counter and every character.
  const index = useMemo(
    () => buildLineSearchIndex(itemOptions, serviceOptions),
    [itemOptions, serviceOptions],
  );

  const searching = looksLikeSearch(value);
  const { quantity: searchQuantity, query } = splitQuery(value);
  const suggestions = useMemo(
    () => (searching ? searchLines(index, query, MAX_SUGGESTIONS) : []),
    [searching, index, query],
  );

  // Timing of the keystrokes making up the current buffer, used to tell a
  // scanner burst from someone typing. See the auto-submit note below.
  const lastKeyAt = useRef(0);
  const fastRun = useRef(0);
  const bufferLength = useRef(0);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = null;
    fastRun.current = 0;
    bufferLength.current = 0;
    setValue("");
    setHighlight(-1);
  }

  function fire(code: string) {
    reset();
    submit(code);
  }

  function pick(result: LineSearchResult) {
    // An item with no sale price cannot go on an invoice. It is shown greyed
    // rather than left out, so the answer to "why is it not in the list" is on
    // screen, and picking it does nothing.
    if (!result.selectable) return;
    reset();
    add(
      { kind: result.kind, id: result.id, name: result.name },
      searchQuantity,
    );
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
            // Arrow keys walk the search list. They only do anything while one
            // is open, so a scan is never affected.
            if (suggestions.length > 0 && e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => (h + 1) % suggestions.length);
              return;
            }
            if (suggestions.length > 0 && e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => (h <= 0 ? suggestions.length : h) - 1);
              return;
            }
            if (e.key === "Escape") {
              setHighlight(-1);
              return;
            }
            if (e.key !== "Enter") return;
            e.preventDefault();
            // Enter adds the highlighted suggestion, but ONLY once the counter
            // has moved onto one with the arrow keys. Left alone, Enter still
            // means "this is a barcode", so a scanner that sends Enter after
            // the code can never be answered with whatever the list was
            // showing at the time.
            const chosen = suggestions[highlight];
            if (chosen) {
              pick(chosen);
              return;
            }
            // A scanner that does send Enter is taken at its word, without
            // waiting out the quiet period. The field is cleared straight away
            // rather than after the request, so the next scan is never typed on
            // top of the last one.
            fire(value);
          }}
          placeholder="Scan, or type a product or service"
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
          helperText="Scan one after another, no need to click or press Enter. Or type a name to find a service or an item with no barcode. For a quantity, type 6* first."
        />

        {/* Matches from the catalogue the page already has, so nothing is
            fetched while typing. Only ever open for something typed by hand:
            a scanner burst is all digits and never reaches here. */}
        {suggestions.length > 0 && (
          <Paper variant="outlined" sx={{ maxHeight: 320, overflowY: "auto" }}>
            <List dense disablePadding>
              {suggestions.map((r, i) => (
                <ListItemButton
                  key={`${r.kind}-${r.id}`}
                  selected={i === highlight}
                  disabled={!r.selectable}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(r)}
                >
                  <ListItemText
                    primary={
                      searchQuantity === 1
                        ? r.name
                        : `${r.name} x${searchQuantity}`
                    }
                    secondary={r.detail}
                  />
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    {r.price != null && (
                      <Typography variant="body2">
                        {formatMoney(r.price)}
                      </Typography>
                    )}
                    <Chip
                      size="small"
                      variant="outlined"
                      label={r.kind === "service" ? "Service" : "Item"}
                    />
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}

        {searching && suggestions.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Nothing matches &ldquo;{query}&rdquo;.
          </Typography>
        )}

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
