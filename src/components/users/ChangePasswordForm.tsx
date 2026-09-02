"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { apiRequest } from "@/utils/api-client";

// Matches the zod rule on the server. Repeated rather than imported so the
// field can say it before the request is made; the server still decides.
const MIN_LENGTH = 8;

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  helperText?: string;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

// A password field with its own reveal. Per-field rather than one switch for the
// form: the usual reason to reveal is a typo in one box, not all three.
function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  helperText,
  error,
  disabled,
  autoFocus,
}: FieldProps) {
  const [shown, setShown] = useState(false);

  return (
    <TextField
      label={label}
      type={shown ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      disabled={disabled}
      error={error}
      helperText={helperText}
      required
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShown((s) => !s)}
                edge="end"
                size="small"
                tabIndex={-1}
                aria-label={shown ? `Hide ${label}` : `Show ${label}`}
              >
                {shown ? (
                  <VisibilityOffIcon fontSize="small" />
                ) : (
                  <VisibilityIcon fontSize="small" />
                )}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

// Changing your own password. The current one is asked for as proof of
// identity: without it, anyone who found an unlocked machine could re-key the
// account and keep it. An admin who resets a forgotten password does that from
// Staff instead, which is the only other way this field changes.
export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;
  const unchanged = next.length > 0 && next === current;
  const ready =
    current.length > 0 &&
    next.length >= MIN_LENGTH &&
    confirm === next &&
    !unchanged;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    setSaving(true);
    try {
      await apiRequest("/api/account/password", {
        method: "PATCH",
        body: { currentPassword: current, newPassword: next },
      });
      // Nothing of the old or the new password is kept on screen afterwards.
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not change the password",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
      <form onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <Stack spacing={0.5}>
            <Typography variant="h6">Change password</Typography>
            <Typography variant="body2" color="text.secondary">
              The password you were given when the account was created can be
              replaced here. Only you can do this: an admin can reset a
              forgotten one from Staff, but cannot read the one in use.
            </Typography>
          </Stack>

          {done && (
            <Alert severity="success" onClose={() => setDone(false)}>
              Password changed. Use the new one the next time you sign in.
            </Alert>
          )}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <PasswordField
            label="Current password"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            disabled={saving}
            autoFocus
          />

          <PasswordField
            label="New password"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            disabled={saving}
            error={tooShort || unchanged}
            helperText={
              unchanged
                ? "That is the password you are already using"
                : tooShort
                  ? `At least ${MIN_LENGTH} characters`
                  : `At least ${MIN_LENGTH} characters. Nothing else is required.`
            }
          />

          <PasswordField
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            disabled={saving}
            error={mismatch}
            helperText={mismatch ? "The two do not match" : " "}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={!ready || saving}
            sx={{ alignSelf: "flex-start" }}
          >
            {saving ? "Changing…" : "Change password"}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
