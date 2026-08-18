"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { apiRequest } from "@/utils/api-client";
import { formatDate, formatMoney } from "@/utils/format";
import type { RunningCostDTO } from "@/types/entities";
import RunningCostFormDialog from "./RunningCostFormDialog";

interface Props {
  initialCosts: RunningCostDTO[];
  canWrite: boolean;
}

function isThisMonth(isoDate: string): boolean {
  if (!isoDate) return false;
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
  return isoDate.startsWith(prefix);
}

export default function RunningCostsTable({ initialCosts, canWrite }: Props) {
  const [costs, setCosts] = useState(initialCosts);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RunningCostDTO | null>(null);
  const firstRender = useRef(true);

  async function load(q: string) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    const data = await apiRequest<{ costs: RunningCostDTO[] }>(
      `/api/running-costs${qs ? `?${qs}` : ""}`,
    );
    setCosts(data.costs);
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => void load(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { monthTotal, listTotal } = useMemo(() => {
    let month = 0;
    let all = 0;
    for (const c of costs) {
      const n = Number(c.amount) || 0;
      all += n;
      if (isThisMonth(c.incurredOn)) month += n;
    }
    return { monthTotal: month, listTotal: all };
  }, [costs]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(cost: RunningCostDTO) {
    setEditing(cost);
    setDialogOpen(true);
  }

  async function handleDelete(cost: RunningCostDTO) {
    if (
      !window.confirm(
        `Delete the ${formatMoney(cost.amount)} ${cost.description} cost?`,
      )
    ) {
      return;
    }
    await apiRequest(`/api/running-costs/${cost.costId}`, { method: "DELETE" });
    void load(query);
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.5 }}
      >
        <Typography variant="h4">Running costs</Typography>
        {canWrite && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
            New cost
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Operating expenses (rent, salaries, utilities, consumables). These feed
        the net-profit figures on the analytics dashboard.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          mb: 2,
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(2, 200px)" },
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            This month
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
            {formatMoney(monthTotal)}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Shown below
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
            {formatMoney(listTotal)}
          </Typography>
        </Paper>
      </Box>

      <TextField
        placeholder="Search by item or category"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Item</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Added by</TableCell>
              {canWrite && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {costs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 6 : 5} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No running costs logged yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              costs.map((c) => (
                <TableRow key={c.costId} hover>
                  <TableCell>{formatDate(c.incurredOn)}</TableCell>
                  <TableCell>
                    {c.description}
                    {c.notes && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {c.notes}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{c.category}</TableCell>
                  <TableCell align="right">{formatMoney(c.amount)}</TableCell>
                  <TableCell>{c.createdByName ?? "-"}</TableCell>
                  {canWrite && (
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(c)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => void handleDelete(c)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <RunningCostFormDialog
        open={dialogOpen}
        cost={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load(query)}
      />
    </Box>
  );
}
