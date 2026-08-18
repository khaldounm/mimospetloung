"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { apiRequest } from "@/utils/api-client";
import { formatDate, formatMoney } from "@/utils/format";
import { groupItemsByCategory } from "@/utils/inventory";
import type { InventoryItemDTO, SupplierDTO } from "@/types/entities";
import AddToOrderDialog from "@/components/orders/AddToOrderDialog";
import InventoryItemFormDialog from "./InventoryItemFormDialog";

// Filter value for items that have no usual supplier assigned yet. Matches the
// sentinel the inventory API understands.
const NO_SUPPLIER = "none";

interface Props {
  initialItems: InventoryItemDTO[];
  canWrite: boolean;
  canViewSuppliers: boolean;
  canCreateSuppliers: boolean;
  /** orders:write. Gates row selection and the push into a future order. */
  canOrder: boolean;
  suppliers: SupplierDTO[];
  /** Preselected supplier filter, from the ?supplier= link on the suppliers page. */
  initialSupplierFilter: string;
}

export default function InventoryTable({
  initialItems,
  canWrite,
  canViewSuppliers,
  canCreateSuppliers,
  canOrder,
  suppliers,
  initialSupplierFilter,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState(initialSupplierFilter);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const firstRender = useRef(true);

  async function load(q: string, lowStock: boolean, supplier: string) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (lowStock) params.set("lowStock", "true");
    if (supplier) params.set("supplier", supplier);
    const qs = params.toString();
    const data = await apiRequest<{ items: InventoryItemDTO[] }>(
      `/api/inventory${qs ? `?${qs}` : ""}`,
    );
    setItems(data.items);
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(
      () => void load(query, lowStockOnly, supplierFilter),
      300,
    );
    return () => clearTimeout(t);
  }, [query, lowStockOnly, supplierFilter]);

  const groups = useMemo(() => groupItemsByCategory(items), [items]);

  // Only items still on screen can be acted on: a selection left over from a
  // previous filter would order things the user can no longer see.
  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.itemId)),
    [items, selected],
  );

  function toggleSelected(itemId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleGroup(groupItems: InventoryItemDTO[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of groupItems) {
        if (checked) next.add(item.itemId);
        else next.delete(item.itemId);
      }
      return next;
    });
  }

  function handleAdded(
    results: { supplierName: string | null; itemsAdded: number }[],
  ) {
    const total = results.reduce((sum, r) => sum + r.itemsAdded, 0);
    const orders = results.length;
    setToast(
      `Added ${total} item(s) to ${orders} order${orders === 1 ? "" : "s"}.`,
    );
    setSelected(new Set());
  }
  // While a search or a filter is on, the groups open so results are visible
  // without extra clicks. Flipping this value remounts the accordions (see the
  // key below), so they collapse again once the filters are cleared.
  const filtering =
    query.trim() !== "" || lowStockOnly || supplierFilter !== "";

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h4">Inventory</Typography>
        <Stack direction="row" spacing={1}>
          {canOrder && selectedItems.length > 0 && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<ShoppingCartIcon />}
              onClick={() => setOrderDialogOpen(true)}
            >
              Add {selectedItems.length} to future order
            </Button>
          )}
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
            >
              New item
            </Button>
          )}
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
        <TextField
          placeholder="Search by name, category, or barcode"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          size="small"
        />
        {canViewSuppliers && (
          <TextField
            select
            label="Supplier"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All suppliers</MenuItem>
            <MenuItem value={NO_SUPPLIER}>Not assigned</MenuItem>
            {suppliers.map((s) => (
              <MenuItem key={s.supplierId} value={String(s.supplierId)}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
        )}
        <FormControlLabel
          control={
            <Switch
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
          }
          label="Low stock"
          sx={{ whiteSpace: "nowrap" }}
        />
      </Stack>

      {groups.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Typography color="text.secondary" align="center">
            No items found.
          </Typography>
        </Paper>
      ) : (
        groups.map((group) => (
          <Accordion
            // Remounting on the filter flip lets the groups open with results and
            // collapse again when the filter clears, with no state to sync.
            key={`${group.category}-${filtering}`}
            defaultExpanded={filtering}
            disableGutters
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              mb: 1.5,
              "&:before": { display: "none" },
              // MUI rounds only the outer corners of the first and last item in a
              // group; force a uniform radius so every card is the same shape.
              "&:first-of-type": { borderRadius: 2 },
              "&:last-of-type": { borderRadius: 2 },
              "&.Mui-expanded": { mb: 1.5 },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", flexWrap: "wrap" }}
              >
                <Typography sx={{ fontWeight: 600 }}>
                  {group.category}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {group.items.length}
                  {group.items.length === 1 ? " item" : " items"}
                </Typography>
                {group.lowStockCount > 0 && (
                  <Chip
                    size="small"
                    color="warning"
                    label={`${group.lowStockCount} low`}
                  />
                )}
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {canOrder && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={group.items.every((i) =>
                              selected.has(i.itemId),
                            )}
                            indeterminate={
                              group.items.some((i) => selected.has(i.itemId)) &&
                              !group.items.every((i) => selected.has(i.itemId))
                            }
                            onChange={(e) =>
                              toggleGroup(group.items, e.target.checked)
                            }
                            slotProps={{
                              input: {
                                "aria-label": `Select all in ${group.category}`,
                              },
                            }}
                          />
                        </TableCell>
                      )}
                      <TableCell>Name</TableCell>
                      {canViewSuppliers && <TableCell>Supplier</TableCell>}
                      <TableCell align="right">Stock</TableCell>
                      <TableCell align="right">Reorder</TableCell>
                      {/* Cost price is what the clinic pays a supplier, so it
                          sits behind the purchasing permission rather than
                          inventory:read, which clinical staff hold. */}
                      {canViewSuppliers && (
                        <TableCell align="right">Cost price</TableCell>
                      )}
                      <TableCell align="right">Sale price</TableCell>
                      <TableCell>Expiry</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.items.map((it) => (
                      <TableRow key={it.itemId} hover>
                        {canOrder && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={selected.has(it.itemId)}
                              onChange={() => toggleSelected(it.itemId)}
                              slotProps={{
                                input: { "aria-label": `Select ${it.name}` },
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", flexWrap: "wrap" }}
                          >
                            <Link href={`/inventory/${it.itemId}`}>
                              {it.name}
                            </Link>
                            {it.partnerName && (
                              <Chip
                                size="small"
                                variant="outlined"
                                color="info"
                                label={it.partnerName}
                              />
                            )}
                            {it.isLowStock && (
                              <Chip
                                size="small"
                                color="warning"
                                label="Low stock"
                              />
                            )}
                            {it.isExpired && (
                              <Chip
                                size="small"
                                color="error"
                                label="Expired"
                              />
                            )}
                          </Stack>
                        </TableCell>
                        {canViewSuppliers && (
                          <TableCell>
                            {it.supplierName ?? (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Not assigned
                              </Typography>
                            )}
                          </TableCell>
                        )}
                        <TableCell align="right">
                          {it.currentStock}
                          {it.unit ? ` ${it.unit}` : ""}
                        </TableCell>
                        <TableCell align="right">{it.reorderLevel}</TableCell>
                        {canViewSuppliers && (
                          <TableCell align="right">
                            {formatMoney(it.lastCost)}
                          </TableCell>
                        )}
                        <TableCell align="right">
                          {formatMoney(it.salePrice)}
                        </TableCell>
                        <TableCell>
                          {it.expiryDate ? formatDate(it.expiryDate) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      <InventoryItemFormDialog
        open={dialogOpen}
        canViewSuppliers={canViewSuppliers}
        canCreateSuppliers={canCreateSuppliers}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load(query, lowStockOnly, supplierFilter)}
      />

      <AddToOrderDialog
        open={orderDialogOpen}
        items={selectedItems}
        onClose={() => setOrderDialogOpen(false)}
        onAdded={handleAdded}
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
