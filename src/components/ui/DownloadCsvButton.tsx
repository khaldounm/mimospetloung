"use client";

import { useState } from "react";
import { CircularProgress, IconButton, Tooltip } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { redirectToSignIn } from "@/utils/api-client";

interface Props {
  /** API route that answers with a CSV body. */
  url: string;
  /** Saved-as name, including the .csv extension. */
  filename: string;
  /** Hover text, and what a screen reader announces. */
  title: string;
  disabled?: boolean;
}

// Downloads a CSV the server builds. Fetched rather than linked to, so the
// session cookie goes with it and a failure can be reported on the button
// instead of replacing the page with an error document.
export default function DownloadCsvButton({
  url,
  filename,
  title,
  disabled,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (res.status === 401) {
        redirectToSignIn();
        throw new Error("Your session has ended. Taking you back to sign in.");
      }
      if (!res.ok) {
        // The route reports its failures as JSON, so read the message out of it
        // rather than saving the error body to a .csv file.
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tooltip title={error ?? title}>
      {/* A disabled button fires no events, so the tooltip needs a wrapper that
          can still be hovered. */}
      <span>
        <IconButton
          size="small"
          aria-label={title}
          color={error ? "error" : "default"}
          disabled={disabled || busy}
          onClick={() => void download()}
        >
          {busy ? (
            <CircularProgress size={18} />
          ) : (
            <DownloadIcon fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
}
