"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // No SMTP configured yet — this is a stub. We always show the same
    // confirmation to avoid leaking which emails exist.
    setSubmitted(true);
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        <Stack component="form" spacing={3} onSubmit={handleSubmit}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Reset password
            </Typography>
            <Typography color="text.secondary">
              Enter your email and we&apos;ll send reset instructions.
            </Typography>
          </Box>

          {submitted ? (
            <Alert severity="info">
              If an account exists for {email || "that address"}, reset
              instructions will be sent. (Email delivery is not configured yet.)
            </Alert>
          ) : (
            <>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                fullWidth
              />
              <Button type="submit" variant="contained" size="large">
                Send reset link
              </Button>
            </>
          )}

          <Typography variant="body2" align="center">
            <Link href="/login">Back to sign in</Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
