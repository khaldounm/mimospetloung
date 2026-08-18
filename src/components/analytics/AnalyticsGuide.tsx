"use client";

import { useState } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";

// One term and its plain-English meaning.
function Term({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Box>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <Stack spacing={1.5}>{children}</Stack>
    </Box>
  );
}

// An info button that opens a plain-language guide to every figure on the
// analytics page: what the page is for, what each term means (COGS especially),
// and how the numbers are worked out.
export default function AnalyticsGuide() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title="What do these numbers mean?">
        <IconButton
          onClick={() => setOpen(true)}
          size="small"
          aria-label="About this page"
        >
          <InfoOutlinedIcon />
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        scroll="paper"
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          Understanding this page
          <IconButton
            onClick={() => setOpen(false)}
            size="small"
            aria-label="Close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>
            <Typography variant="body2">
              A snapshot of your clinic&apos;s money and stock: the figures are
              for the current month, and charts marked &quot;12 months&quot;
              show the trend over the past year. Here is what each number means
              and how it is worked out.
            </Typography>

            <Section title="Profitability">
              <Term label="Revenue this month">
                Money you actually collected from clients this month (payments
                received, not just billed).
              </Term>
              <Term label="Cost of goods sold (COGS)">
                What the clinic-owned items you SOLD this month originally cost
                you to buy. Example: you sell a bag of treats that cost you $5,
                so $5 is COGS. It is the cost of the goods, not their sale
                price. Items sourced from a partner are counted under Partner
                payouts instead, not here.
              </Term>
              <Term label="Partner payouts">
                What you owe partners on the consigned items they sourced that
                sold this month: their cost back plus their agreed share of the
                profit. Example: a partner&apos;s item cost $10 and sold for $25
                at a 20% share, so you owe them $10 + 20% of $15 = $13.
              </Term>
              <Term label="Operating costs">
                Your running costs logged this month: rent, salaries, utilities,
                and the like.
              </Term>
              <Term label="Net profit this month">
                Revenue minus COGS minus partner payouts minus operating costs.
                The money you truly made this month.
              </Term>
              <Term label="Inventory on hand">
                The value of the clinic-owned stock you are holding right now,
                valued at what it cost you. This is an asset you own, not money
                lost. Consigned stock is funded by partners, so it is not
                included here.
              </Term>
            </Section>

            <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Why buying stock is not a loss
              </Typography>
              <Typography variant="body2" color="text.secondary">
                When you buy inventory you swap cash for goods of equal value,
                so your profit does not drop. That cost only counts (as COGS)
                when you sell the item. Your cash going down is a separate thing
                (cash flow) from whether you made a profit.
              </Typography>
            </Box>

            <Section title="Revenue & financial">
              <Term label="Collected vs Invoiced">
                Collected is cash received this month; Invoiced is the value you
                billed this month. They differ when clients have not paid yet.
              </Term>
              <Term label="Outstanding">
                Unpaid balance still owed across issued invoices.
              </Term>
              <Term label="Avg invoice">
                Average total of an invoice (excluding drafts and voided ones).
              </Term>
              <Term label="Void rate">
                Share of invoices that were cancelled (voided).
              </Term>
            </Section>

            <Section title="Clients & patients">
              <Term label="Active clients">
                Clients on file who are not archived.
              </Term>
              <Term label="New this month / Lapsed (6 mo)">
                Clients added this month, and clients with no visit in the last
                six months.
              </Term>
              <Term label="Total patients">
                Animals registered across all clients.
              </Term>
            </Section>

            <Section title="Inventory">
              <Term label="Total items">
                How many active products you stock.
              </Term>
              <Term label="Stock value">
                Quantity on hand times its cost, added up. Same figure as
                Inventory on hand.
              </Term>
              <Term label="Low stock / Out of stock">
                Items at or below their reorder level, and items with zero on
                hand. Low stock needs a reorder level set on the item.
              </Term>
              <Term label="Expiring (30d)">
                Items whose expiry date falls within the next 30 days.
              </Term>
            </Section>

            <Section title="Bookings & operations">
              <Term label="This month">
                Appointments scheduled in the current month.
              </Term>
              <Term label="Completed / No-show (90d)">
                Share of the last 90 days&apos; bookings that were completed,
                and that were no-shows.
              </Term>
            </Section>

            <Typography variant="caption" color="text.secondary">
              Charts stay empty until there is data to show. Money figures use
              the current calendar month unless a chart says otherwise.
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
