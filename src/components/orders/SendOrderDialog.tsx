"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from "@mui/material";
import { apiRequest } from "@/utils/api-client";
import type { PurchaseOrderDTO, SupplierContactDTO } from "@/types/entities";

interface Props {
  open: boolean;
  order: PurchaseOrderDTO;
  contacts: SupplierContactDTO[];
  onClose: () => void;
  onSent: (contactName: string) => void;
}

/**
 * Which contacts cover what this order is actually buying. A supplier is often
 * split by product line, so an order of food should default to the food rep
 * rather than to whoever happens to be first in the list.
 *
 * Returns the categories on the order and the contacts matching any of them. A
 * contact with no categories is general (typically accounts) and never matches,
 * though it stays selectable.
 */
function matchContacts(
  order: PurchaseOrderDTO,
  contacts: SupplierContactDTO[],
): { categories: string[]; matched: SupplierContactDTO[] } {
  const categories = [
    ...new Set(
      (order.lines ?? [])
        .map((l) => l.category)
        .filter((c): c is string => Boolean(c)),
    ),
  ];
  const matched = contacts.filter((c) =>
    c.categories.some((cat) => categories.includes(cat)),
  );
  return { categories, matched };
}

export default function SendOrderDialog(props: Props) {
  // Remount per order so the preselect recomputes from props at mount.
  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      {props.open && <SendOrderForm key={props.order.orderId} {...props} />}
    </Dialog>
  );
}

function SendOrderForm({ order, contacts, onClose, onSent }: Props) {
  const { categories, matched } = useMemo(
    () => matchContacts(order, contacts),
    [order, contacts],
  );

  // Only contacts with a number can receive a WhatsApp message.
  const reachable = useMemo(
    () => contacts.filter((c) => Boolean(c.phone)),
    [contacts],
  );

  const [contactId, setContactId] = useState<number | null>(() => {
    const preferred = matched.find((c) => c.phone);
    return (
      preferred?.contactId ??
      reachable.find((c) => c.isPrimary)?.contactId ??
      reachable[0]?.contactId ??
      null
    );
  });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Categories on this order that nobody covers, worth saying out loud before
  // the whole order goes to one person who only handles half of it.
  const uncovered = categories.filter(
    (cat) => !contacts.some((c) => c.categories.includes(cat)),
  );
  const selected = contacts.find((c) => c.contactId === contactId) ?? null;
  const splitAcross = matched.length > 1;

  async function handleSend() {
    if (contactId == null) return;
    setError(null);
    setSending(true);
    try {
      const res = await apiRequest<{ sentTo: string }>(
        `/api/orders/${order.orderId}/whatsapp`,
        { method: "POST", body: { contactId } },
      );
      onSent(res.sentTo);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <DialogTitle>Send order via WhatsApp</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {contacts.length === 0 ? (
            <Alert severity="warning">
              {order.supplierName ?? "This supplier"} has no contacts yet. Add
              one from the supplier&apos;s page, then send from here.
            </Alert>
          ) : reachable.length === 0 ? (
            <Alert severity="warning">
              None of {order.supplierName}&apos;s contacts has a phone number.
              WhatsApp needs one, so add a number on the supplier&apos;s page.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                {categories.length > 0
                  ? `This order covers ${categories.join(", ")}.`
                  : "The items on this order have no category set."}
              </Typography>

              {splitAcross && (
                <Alert severity="info">
                  More than one contact covers what is on this order. The whole
                  PDF goes to whoever you pick, so split the order if they
                  should each only see their own lines.
                </Alert>
              )}

              {uncovered.length > 0 && contacts.length > 0 && (
                <Alert severity="info">
                  {`Nobody here is marked as handling ${uncovered.join(", ")}.`}
                </Alert>
              )}

              <RadioGroup
                value={contactId ?? ""}
                onChange={(e) => setContactId(Number(e.target.value))}
              >
                {contacts.map((c) => {
                  const isMatch = matched.some(
                    (m) => m.contactId === c.contactId,
                  );
                  return (
                    <FormControlLabel
                      key={c.contactId}
                      value={c.contactId}
                      disabled={!c.phone}
                      control={<Radio />}
                      label={
                        <Stack sx={{ py: 0.5 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", flexWrap: "wrap" }}
                          >
                            <Typography variant="body2">{c.name}</Typography>
                            {c.role && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {c.role}
                              </Typography>
                            )}
                            {isMatch && (
                              <Chip
                                size="small"
                                color="primary"
                                label="Handles this order"
                              />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {c.phone || "No phone number"}
                            {c.categories.length > 0
                              ? ` · ${c.categories.join(", ")}`
                              : ""}
                          </Typography>
                        </Stack>
                      }
                    />
                  );
                })}
              </RadioGroup>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSend()}
          disabled={sending || contactId == null || !selected?.phone}
        >
          {sending ? "Sending…" : "Send"}
        </Button>
      </DialogActions>
    </>
  );
}
