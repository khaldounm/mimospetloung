"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { apiRequest } from "@/utils/api-client";
import { formatMoney } from "@/utils/format";
import { RECORD_TYPES } from "@/types/enums";
import type { ServiceDTO } from "@/types/entities";
import ServiceFormDialog from "./ServiceFormDialog";

const CATEGORY_ORDER = [...RECORD_TYPES, null] as (string | null)[];

function groupByCategory(services: ServiceDTO[]) {
  const map = new Map<string | null, ServiceDTO[]>();
  for (const s of services) {
    const key = s.category ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  for (const arr of map.values())
    arr.sort((a, b) => a.name.localeCompare(b.name));
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
    category: c,
    services: map.get(c)!,
  }));
}

interface Props {
  initialServices: ServiceDTO[];
  canWrite: boolean;
}

export default function ServicesTable({ initialServices, canWrite }: Props) {
  const [services, setServices] = useState(initialServices);
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceDTO | null>(null);
  const firstRender = useRef(true);

  async function load(q: string, active: boolean) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (active) params.set("activeOnly", "true");
    const qs = params.toString();
    const data = await apiRequest<{ services: ServiceDTO[] }>(
      `/api/services${qs ? `?${qs}` : ""}`,
    );
    setServices(data.services);
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => void load(query, activeOnly), 300);
    return () => clearTimeout(t);
  }, [query, activeOnly]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(s: ServiceDTO) {
    setEditing(s);
    setDialogOpen(true);
  }

  const groups = groupByCategory(services);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h4">Services</Typography>
        <Stack direction="row" spacing={1}>
          <Button component={Link} href="/invoices" variant="outlined">
            Invoices
          </Button>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openNew}
            >
              New service
            </Button>
          )}
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
        <TextField
          placeholder="Search by name or category"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          size="small"
        />
        <FormControlLabel
          control={
            <Switch
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
          }
          label="Active only"
          sx={{ whiteSpace: "nowrap" }}
        />
      </Stack>

      {services.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No services found.
        </Typography>
      ) : (
        groups.map(({ category, services: group }) => {
          const key = category ?? "__none__";
          return (
            <Accordion
              key={key}
              defaultExpanded={category === RECORD_TYPES[0]}
              disableGutters
              elevation={0}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                "&:not(:last-child)": { borderBottom: 0 },
                "&::before": { display: "none" },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <Typography
                    sx={{
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontSize: "0.8rem",
                      letterSpacing: 0.5,
                    }}
                  >
                    {category ?? "Uncategorized"}
                  </Typography>
                  <Chip
                    label={group.length}
                    size="small"
                    sx={{ height: 18, fontSize: "0.7rem" }}
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell>Status</TableCell>
                      {canWrite && <TableCell align="right">Edit</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.map((s) => (
                      <TableRow key={s.serviceId} hover>
                        <TableCell>{s.name}</TableCell>
                        <TableCell align="right">
                          {formatMoney(s.price)}
                        </TableCell>
                        <TableCell>
                          {s.isActive ? (
                            <Chip size="small" color="success" label="Active" />
                          ) : (
                            <Chip size="small" label="Inactive" />
                          )}
                        </TableCell>
                        {canWrite && (
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              aria-label="Edit service"
                              onClick={() => openEdit(s)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionDetails>
            </Accordion>
          );
        })
      )}

      <ServiceFormDialog
        open={dialogOpen}
        service={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load(query, activeOnly)}
      />
    </Box>
  );
}
