"use client";

import Pagination from "@mui/material/Pagination";
import PaginationItem from "@mui/material/PaginationItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIcon from "@mui/icons-material/ArrowForwardIos";

// Centred pager for the server-paged tables. MUI's TablePagination puts a
// rows-per-page selector and a cramped arrow pair in the bottom right, which
// reads as a spreadsheet control; this is the same information as a row of
// numbered pages you can aim at, with the range spelled out underneath.
export default function TablePaginationBar({
  page,
  count,
  pageSize,
  onChange,
  loading = false,
  noun = "results",
}: {
  /** Zero-based, matching the table's own state. */
  page: number;
  /** Total rows across all pages. */
  count: number;
  pageSize: number;
  onChange: (page: number) => void;
  loading?: boolean;
  /** What is being counted, for the summary line. */
  noun?: string;
}) {
  const pageCount = Math.max(Math.ceil(count / pageSize), 1);
  const from = count === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, count);
  const fmt = (n: number) => n.toLocaleString();

  return (
    <Stack
      spacing={1.25}
      sx={{
        alignItems: "center",
        py: 3,
        borderTop: 1,
        borderColor: "divider",
        // Dims during a fetch instead of collapsing, so the row of numbers does
        // not jump under the cursor mid-click.
        opacity: loading ? 0.55 : 1,
        transition: "opacity 120ms ease",
      }}
    >
      <Pagination
        page={page + 1}
        count={pageCount}
        onChange={(_, next) => onChange(next - 1)}
        siblingCount={1}
        boundaryCount={1}
        shape="rounded"
        disabled={loading}
        renderItem={(item) => (
          <PaginationItem
            slots={{ previous: ArrowBackIcon, next: ArrowForwardIcon }}
            {...item}
          />
        )}
        sx={{
          "& .MuiPagination-ul": { gap: 0.5 },
          "& .MuiPaginationItem-root": {
            minWidth: 38,
            height: 38,
            margin: 0,
            borderRadius: 1,
            fontSize: "0.875rem",
            fontWeight: 500,
            // Page numbers sit in a row, so they must not shift width per digit.
            fontVariantNumeric: "tabular-nums",
            color: "text.secondary",
            border: "1px solid transparent",
            transition:
              "background-color 120ms ease, color 120ms ease, border-color 120ms ease",
            "&:hover": {
              backgroundColor: "action.hover",
              borderColor: "divider",
              color: "text.primary",
            },
          },
          "& .MuiPaginationItem-icon": { fontSize: "0.9rem" },
          "& .MuiPaginationItem-ellipsis": {
            color: "text.disabled",
            height: 38,
            lineHeight: "38px",
          },
          "& .MuiPaginationItem-root.Mui-selected": {
            backgroundColor: "primary.main",
            color: "primary.contrastText",
            borderColor: "primary.main",
            fontWeight: 600,
            "&:hover": {
              backgroundColor: "primary.main",
              color: "primary.contrastText",
            },
          },
          "& .MuiPaginationItem-root.Mui-focusVisible": {
            outline: 2,
            outlineColor: "secondary.main",
            outlineOffset: 2,
          },
        }}
      />

      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontSize: "0.6875rem",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count === 0
          ? `No ${noun}`
          : `${fmt(from)}-${fmt(to)} of ${fmt(count)} ${noun}`}
      </Typography>
    </Stack>
  );
}
