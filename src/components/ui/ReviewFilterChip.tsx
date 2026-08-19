"use client";

import { Chip, Tooltip } from "@mui/material";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";

interface Props {
  /** How many records are flagged in total, regardless of other filters. */
  count: number;
  active: boolean;
  onToggle: (next: boolean) => void;
  /** What is being counted, for the tooltip: "clients", "pets". */
  noun: string;
}

/**
 * Toggles the list down to records the migration flagged for a human to
 * confirm. Hidden entirely once nothing is flagged, so it disappears when the
 * clinic has worked through the queue rather than sitting there reading zero.
 */
export default function ReviewFilterChip({
  count,
  active,
  onToggle,
  noun,
}: Props) {
  if (count === 0 && !active) return null;

  return (
    <Tooltip
      title={
        active
          ? "Showing only records that need checking. Click to show all again."
          : `${count} ${noun} imported from the old system need someone to confirm the details.`
      }
    >
      <Chip
        icon={<FlagOutlinedIcon />}
        label={active ? `Needs review (${count})` : `Needs review · ${count}`}
        color={active ? "warning" : "default"}
        variant={active ? "filled" : "outlined"}
        onClick={() => onToggle(!active)}
      />
    </Tooltip>
  );
}
