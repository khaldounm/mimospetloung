"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DescriptionIcon from "@mui/icons-material/Description";
import { formatDate, formatMoney } from "@/utils/format";
import StatCard from "@/components/ui/StatCard";
import { ORDER_STATUS_COLOR, NO_SUPPLIER_LABEL } from "@/constants/order";
import type { PurchaseOrderDTO } from "@/types/entities";
import type { PurchaseOrderStatus } from "@/types/enums";

type Filter = "Open" | PurchaseOrderStatus;

// Everything still in flight. Partial belongs here: part of it has arrived and
// the rest is expected, so it is the most open an order can be. Leaving it out
// hid such orders from every tab at once.
const OPEN_STATUSES: PurchaseOrderStatus[] = ["Draft", "Placed", "Partial"];

interface Props {
  initialOrders: PurchaseOrderDTO[];
}

interface SupplierGroup {
  key: string;
  supplierName: string;
  orders: PurchaseOrderDTO[];
  value: number;
}

export default function OrdersTable({ initialOrders }: Props) {
  // "Open" is the working view: everything still in flight. The terminal
  // statuses are one click away rather than cluttering the default.
  const [filter, setFilter] = useState<Filter>("Open");

  const totals = useMemo(() => {
    let drafts = 0;
    let awaiting = 0;
    let draftValue = 0;
    for (const o of initialOrders) {
      if (o.status === "Draft") {
        drafts += 1;
        draftValue += Number(o.total);
      }
      // A Partial order is still waiting on the rest of its delivery, so it
      // belongs here alongside Placed.
      if (o.status === "Placed" || o.status === "Partial") awaiting += 1;
    }
    return { drafts, awaiting, draftValue };
  }, [initialOrders]);

  // Group by supplier, orders inside each group already sorted newest first by
  // the server. The unassigned bucket is pinned to the top: it is the one that
  // needs a decision before anything can be ordered.
  const groups = useMemo(() => {
    const visible = initialOrders.filter((o) =>
      filter === "Open"
        ? OPEN_STATUSES.includes(o.status)
        : o.status === filter,
    );

    const map = new Map<string, SupplierGroup>();
    for (const order of visible) {
      const key = order.supplierId == null ? "none" : String(order.supplierId);
      const group = map.get(key);
      if (group) {
        group.orders.push(order);
        group.value += Number(order.total);
      } else {
        map.set(key, {
          key,
          supplierName: order.supplierName ?? NO_SUPPLIER_LABEL,
          orders: [order],
          value: Number(order.total),
        });
      }
    }

    return [...map.values()].sort((a, b) => {
      if (a.key === "none") return -1;
      if (b.key === "none") return 1;
      return a.supplierName.localeCompare(b.supplierName);
    });
  }, [initialOrders, filter]);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.5 }}
      >
        <Typography variant="h4">Orders</Typography>
        <Button
          component={Link}
          href="/orders/statement"
          variant="outlined"
          startIcon={<DescriptionIcon />}
        >
          Statement
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Reorder sheets grouped by supplier. Add low-stock items from Inventory,
        then place the order and receive it when the stock arrives.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          mb: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        }}
      >
        <StatCard label="Open drafts" value={String(totals.drafts)} />
        <StatCard
          label="Awaiting delivery"
          value={String(totals.awaiting)}
          accent={totals.awaiting > 0 ? "info" : undefined}
          hint="Placed or part-delivered"
        />
        <StatCard label="Draft value" value={formatMoney(totals.draftValue)} />
      </Box>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(_e, next: Filter | null) => next && setFilter(next)}
        sx={{ mb: 2, flexWrap: "wrap" }}
      >
        <ToggleButton value="Open">Open</ToggleButton>
        <ToggleButton value="Draft">Draft</ToggleButton>
        <ToggleButton value="Placed">Placed</ToggleButton>
        <ToggleButton value="Partial">Partial</ToggleButton>
        <ToggleButton value="Received">Received</ToggleButton>
        <ToggleButton value="Cancelled">Cancelled</ToggleButton>
      </ToggleButtonGroup>

      {groups.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Typography color="text.secondary" align="center">
            No orders here yet. Tick low-stock items in Inventory and choose Add
            to future order.
          </Typography>
        </Paper>
      ) : (
        groups.map((group) => (
          <Accordion
            key={`${group.key}-${filter}`}
            defaultExpanded
            disableGutters
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              mb: 1.5,
              "&:before": { display: "none" },
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
                  {group.supplierName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {group.orders.length}
                  {group.orders.length === 1 ? " order" : " orders"}
                </Typography>
                {group.key === "none" && (
                  <Chip
                    size="small"
                    color="warning"
                    label="Assign a supplier to order"
                  />
                )}
                <Typography variant="body2" color="text.secondary">
                  {formatMoney(group.value)}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Order</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Started</TableCell>
                      <TableCell>Placed</TableCell>
                      <TableCell>Received</TableCell>
                      <TableCell align="right">Items</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.orders.map((o) => (
                      <TableRow key={o.orderId} hover>
                        <TableCell>
                          <Link href={`/orders/${o.orderId}`}>
                            {o.reference || `Order #${o.orderId}`}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={ORDER_STATUS_COLOR[o.status]}
                            label={o.status}
                          />
                        </TableCell>
                        <TableCell>{formatDate(o.createdAt)}</TableCell>
                        <TableCell>
                          {o.orderedOn ? formatDate(o.orderedOn) : "-"}
                        </TableCell>
                        <TableCell>
                          {o.receivedOn ? formatDate(o.receivedOn) : "-"}
                        </TableCell>
                        <TableCell align="right">{o.lineCount}</TableCell>
                        <TableCell align="right">
                          {formatMoney(o.total)}
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
    </Box>
  );
}
