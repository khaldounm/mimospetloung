"use client";

import { useState } from "react";
import { Button, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useCostSaved } from "@/hooks/useCostSaved";
import RunningCostPeriodNav from "./RunningCostPeriodNav";
import RunningCostFormDialog from "./RunningCostFormDialog";
import type { CostMonthDTO } from "@/types/entities";

interface Props {
  months: CostMonthDTO[];
  canWrite: boolean;
}

// Title, the New cost entry point and the period rail. Rendered by the layout,
// so it survives every move between months and categories untouched.
export default function RunningCostsHeader({ months, canWrite }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const onSaved = useCostSaved();

  return (
    <>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.5 }}
      >
        <Typography variant="h4">Running costs</Typography>
        {canWrite && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            New cost
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Operating expenses (rent, salaries, utilities, consumables). These feed
        the net-profit figures on the analytics dashboard.
      </Typography>

      <RunningCostPeriodNav months={months} />

      <RunningCostFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={onSaved}
      />
    </>
  );
}
