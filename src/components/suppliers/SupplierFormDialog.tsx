"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Radio,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { apiRequest } from "@/utils/api-client";
import { INVENTORY_CATEGORIES } from "@/constants/inventory";
import type { SupplierContactDTO, SupplierDTO } from "@/types/entities";

interface Props {
  open: boolean;
  supplier?: SupplierDTO | null;
  /** Prefills the name when opened from a "create this supplier" shortcut. */
  initialName?: string;
  onClose: () => void;
  /** Receives the saved record so callers can select it straight away. */
  onSaved: (supplier: SupplierDTO) => void;
}

export default function SupplierFormDialog({ open, onClose, ...rest }: Props) {
  // Remount per record (via key) so state initializes from props at mount.
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      {open && (
        <SupplierForm
          key={rest.supplier?.supplierId ?? "new"}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}

type FormProps = Omit<Props, "open">;

// A contact as the form holds it. contactId is absent on a row added here and
// present on one loaded from the record, which is what lets the save update in
// place rather than delete and recreate. `key` identifies a row before it has
// an id, so adding or removing rows never moves the primary flag.
interface ContactDraft {
  key: string;
  contactId?: number;
  name: string;
  role: string;
  categories: string[];
  phone: string;
  email: string;
}

let draftSeq = 0;
const nextKey = () => `new-${(draftSeq += 1)}`;

function blankContact(): ContactDraft {
  return {
    key: nextKey(),
    name: "",
    role: "",
    categories: [],
    phone: "",
    email: "",
  };
}

function toDraft(c: SupplierContactDTO): ContactDraft {
  return {
    key: `saved-${c.contactId}`,
    contactId: c.contactId,
    name: c.name,
    role: c.role ?? "",
    categories: c.categories,
    phone: c.phone ?? "",
    email: c.email ?? "",
  };
}

// A row the user added and never typed into. Dropped on save rather than
// rejected, so an accidental "Add contact" does not block the whole dialog.
const isUntouched = (c: ContactDraft) =>
  !c.name.trim() && !c.phone.trim() && !c.email.trim();

function SupplierForm({ supplier, initialName, onClose, onSaved }: FormProps) {
  const editing = Boolean(supplier);
  const [name, setName] = useState(supplier?.name ?? initialName ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true);
  const [contacts, setContacts] = useState<ContactDraft[]>(() =>
    supplier?.contacts?.length ? supplier.contacts.map(toDraft) : [],
  );
  const [primaryKey, setPrimaryKey] = useState<string | null>(() => {
    const found = supplier?.contacts?.find((c) => c.isPrimary);
    return found ? `saved-${found.contactId}` : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateContact(key: string, patch: Partial<ContactDraft>) {
    setContacts((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    );
  }

  function addContact() {
    const draft = blankContact();
    setContacts((prev) => [...prev, draft]);
    // First contact added becomes the primary, so the common single-contact
    // case never needs the radio touched.
    setPrimaryKey((prev) => prev ?? draft.key);
  }

  function removeContact(key: string) {
    setContacts((prev) => {
      const next = prev.filter((c) => c.key !== key);
      if (key === primaryKey) setPrimaryKey(next[0]?.key ?? null);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }

    const filled = contacts.filter((c) => !isUntouched(c));
    const missingName = filled.find((c) => !c.name.trim());
    if (missingName) {
      setError("Every contact needs a name.");
      return;
    }
    const unreachable = filled.find((c) => !c.phone.trim() && !c.email.trim());
    if (unreachable) {
      setError(
        `Add a phone number or an email for ${unreachable.name.trim()}.`,
      );
      return;
    }

    setSaving(true);
    try {
      const body = {
        name,
        notes,
        isActive,
        contacts: filled.map((c) => ({
          ...(c.contactId ? { contactId: c.contactId } : {}),
          name: c.name,
          role: c.role,
          categories: c.categories,
          phone: c.phone,
          email: c.email,
          isPrimary: c.key === primaryKey,
        })),
      };
      const res = editing
        ? await apiRequest<{ supplier: SupplierDTO }>(
            `/api/suppliers/${supplier!.supplierId}`,
            { method: "PATCH", body },
          )
        : await apiRequest<{ supplier: SupplierDTO }>("/api/suppliers", {
            method: "POST",
            body,
          });
      onSaved(res.supplier);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Company name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
          />

          <Divider textAlign="left" sx={{ pt: 1 }}>
            <Typography variant="overline" color="text.secondary">
              Contacts
            </Typography>
          </Divider>

          {contacts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No contacts yet. Add the people you deal with at this company, one
              per product line if that is how they split it.
            </Typography>
          ) : (
            contacts.map((c, index) => (
              <Box
                key={c.key}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 2,
                  pt: 1,
                }}
              >
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Contact {index + 1}
                  </Typography>
                  <Stack direction="row" sx={{ alignItems: "center" }}>
                    <Tooltip title="Shown wherever only one contact fits">
                      <FormControlLabel
                        control={
                          <Radio
                            size="small"
                            checked={primaryKey === c.key}
                            onChange={() => setPrimaryKey(c.key)}
                          />
                        }
                        label={
                          <Typography variant="caption">Primary</Typography>
                        }
                        sx={{ mr: 0 }}
                      />
                    </Tooltip>
                    <Tooltip title="Remove contact">
                      <IconButton
                        size="small"
                        onClick={() => removeContact(c.key)}
                      >
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Name"
                      value={c.name}
                      onChange={(e) =>
                        updateContact(c.key, { name: e.target.value })
                      }
                      fullWidth
                    />
                    <TextField
                      label="Role"
                      value={c.role}
                      onChange={(e) =>
                        updateContact(c.key, { role: e.target.value })
                      }
                      placeholder="e.g. Sales rep, Accounts"
                      fullWidth
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Phone"
                      value={c.phone}
                      onChange={(e) =>
                        updateContact(c.key, { phone: e.target.value })
                      }
                      fullWidth
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={c.email}
                      onChange={(e) =>
                        updateContact(c.key, { email: e.target.value })
                      }
                      fullWidth
                    />
                  </Stack>
                  <TextField
                    select
                    label="Handles"
                    value={c.categories}
                    onChange={(e) => {
                      // A multiple Select hands back an array at runtime even
                      // though TextField types the value as a string.
                      const value = e.target.value as unknown as
                        | string
                        | string[];
                      updateContact(c.key, {
                        categories:
                          typeof value === "string" ? value.split(",") : value,
                      });
                    }}
                    helperText="Which shelves this person covers. Leave empty for a general contact."
                    slotProps={{
                      select: {
                        multiple: true,
                        renderValue: (selected) => (
                          <Stack
                            direction="row"
                            sx={{ flexWrap: "wrap", gap: 0.5 }}
                          >
                            {(selected as string[]).map((v) => (
                              <Chip key={v} size="small" label={v} />
                            ))}
                          </Stack>
                        ),
                      },
                    }}
                    fullWidth
                  >
                    {INVENTORY_CATEGORIES.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </Box>
            ))
          )}

          <Box>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addContact}
              disabled={contacts.length >= 20}
            >
              Add contact
            </Button>
          </Box>

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          {editing && (
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              }
              label="Active (offered when tagging inventory items)"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </form>
  );
}
