"use client";

import { useRef, useState } from "react";
import { apiRequest } from "@/utils/api-client";
import { beepAccept, beepReject } from "@/utils/beep";
import { toGtin14 } from "@/utils/barcode";
import type { InvoiceDTO } from "@/types/entities";
import type { ItemLineOption } from "@/components/invoices/LineItemDialog";

export interface PendingScan {
  id: number;
  label: string;
  quantity: number;
}

export interface ScanFeedback {
  kind: "accepted" | "rejected";
  message: string;
  // Bumped on every scan so repeating the same message still re-triggers the
  // flash in the UI.
  at: number;
}

interface Scanner {
  submit: (raw: string) => void;
  pending: PendingScan[];
  feedback: ScanFeedback | null;
  unmatched: string[];
  dismissUnmatched: (code: string) => void;
}

// A quantity multiplier typed before the code, as "6*<barcode>". A bare leading
// number cannot be used: a scanner types its digits into the same field, so
// "6" followed by a scan is indistinguishable from a longer barcode. The
// asterisk never appears in a GTIN, which makes the split unambiguous.
const MULTIPLIER = /^(\d{1,4})\s*\*\s*(.+)$/;

// Drives scan-to-line entry on a draft invoice.
//
// Requests are chained rather than fired in parallel: every response carries
// the whole recomputed invoice, so two in flight at once would race and the
// slower one would overwrite the newer totals. Chaining keeps the input free
// (a scan is accepted instantly and queued) while the server stays the single
// source of truth for what is on the invoice.
export function useInvoiceScanner(
  invoiceId: number,
  itemOptions: ItemLineOption[],
  onInvoiceUpdated: (invoice: InvoiceDTO) => void,
): Scanner {
  const [pending, setPending] = useState<PendingScan[]>([]);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const nextId = useRef(0);

  function submit(raw: string): void {
    const text = raw.trim();
    if (!text) return;

    const parts = MULTIPLIER.exec(text);
    const quantity = parts ? Number(parts[1]) : 1;
    const code = parts ? parts[2]!.trim() : text;

    // Resolved locally as well as on the server, purely so the queued chip can
    // name the product straight away instead of showing a bare number.
    const scanned = toGtin14(code);
    const known = itemOptions.find(
      (o) => o.barcode != null && toGtin14(o.barcode) === scanned,
    );

    const id = ++nextId.current;
    setPending((p) => [...p, { id, label: known?.name ?? code, quantity }]);

    chain.current = chain.current
      .then(async () => {
        try {
          const data = await apiRequest<{
            invoice: InvoiceDTO;
            itemName: string;
          }>(`/api/invoices/${invoiceId}/scan`, {
            method: "POST",
            body: { barcode: code, quantity },
          });
          onInvoiceUpdated(data.invoice);
          beepAccept();
          setFeedback({
            kind: "accepted",
            message:
              quantity === 1 ? data.itemName : `${data.itemName} x${quantity}`,
            at: Date.now(),
          });
        } catch (err) {
          beepReject();
          const message =
            err instanceof Error ? err.message : "That scan did not go through";
          setFeedback({ kind: "rejected", message, at: Date.now() });
          setUnmatched((u) => (u.includes(code) ? u : [...u, code]));
        } finally {
          setPending((p) => p.filter((s) => s.id !== id));
        }
      })
      // The chain must survive a failed link, or one bad scan would stop every
      // scan after it.
      .catch(() => undefined);
  }

  function dismissUnmatched(code: string): void {
    setUnmatched((u) => u.filter((c) => c !== code));
  }

  return { submit, pending, feedback, unmatched, dismissUnmatched };
}
