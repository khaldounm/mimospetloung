import { Box, CircularProgress } from "@mui/material";

// Shown while a dashboard page renders on the server.
//
// Without a loading boundary an App Router navigation blocks: the click lands,
// the old page sits there unchanged, and nothing happens until the whole payload
// comes back from Frankfurt. That is a round trip the clinic cannot avoid, since
// caching the answer would mean showing stale figures at the till. What it can
// avoid is the click looking like it did nothing.
//
// This does not make anything faster and is not meant to. It makes the wait
// visible.
export default function DashboardLoading() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // The shell keeps its nav and its top bar, so this fills the content
        // area rather than the viewport. Roughly the height of a page, so the
        // spinner lands where the eye already is instead of at the very top.
        minHeight: "70vh",
        // Held back so a fast navigation does not flash a spinner on and off
        // again, which reads as jank rather than as progress. `both` keeps it
        // invisible through the delay, so anything answered inside 220ms shows
        // no spinner at all.
        "@keyframes dashboardLoadingIn": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        animation: "dashboardLoadingIn 160ms ease-out 220ms both",
      }}
    >
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}
