import { Paper, Typography } from "@mui/material";

type Accent = "warning" | "success" | "error" | "primary" | "info";

interface Props {
  label: string;
  value: string;
  hint?: string;
  // Adds a colored left border to draw the eye to headline figures.
  accent?: Accent;
}

// Compact metric tile shared by the Partners ledger and the analytics overview.
export default function StatCard({ label, value, hint, accent }: Props) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: "100%",
        ...(accent
          ? { borderColor: `${accent}.main`, borderLeftWidth: 3 }
          : {}),
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
        {value}
      </Typography>
      {hint && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5 }}
        >
          {hint}
        </Typography>
      )}
    </Paper>
  );
}
