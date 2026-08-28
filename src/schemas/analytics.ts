import { z } from "zod";

// The analytics sections that can be re-queried for a custom date range. The
// snapshot sections (clients, inventory) are not time-boxed and so are not here.
export const ANALYTICS_SECTIONS = [
  "revenue",
  "profit",
  "purchases",
  "bookings",
  "categories",
  "items",
] as const;
export type AnalyticsSection = (typeof ANALYTICS_SECTIONS)[number];

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

// Validates the /api/analytics query: a known section plus an inclusive,
// correctly-ordered date range.
export const analyticsSectionQuerySchema = z
  .object({
    section: z.enum(ANALYTICS_SECTIONS),
    from: dateString,
    to: dateString,
  })
  .refine((d) => d.from <= d.to, {
    message: "from must be on or before to",
    path: ["from"],
  });

export type AnalyticsSectionQuery = z.infer<typeof analyticsSectionQuerySchema>;

// Validates the per-item performance lookup: which item, over which range. The
// range is the same shape the sections use, so the detail view and the
// leaderboard above it always speak about the same window.
export const itemPerformanceQuerySchema = z
  .object({
    itemId: z.coerce.number().int().positive(),
    from: dateString,
    to: dateString,
  })
  .refine((d) => d.from <= d.to, {
    message: "from must be on or before to",
    path: ["from"],
  });

export type ItemPerformanceQuery = z.infer<typeof itemPerformanceQuerySchema>;

// Validates the predictive item search. An empty query is allowed and returns a
// starting page, so opening the picker shows something rather than a blank box.
export const itemSearchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export type ItemSearchQuery = z.infer<typeof itemSearchQuerySchema>;
