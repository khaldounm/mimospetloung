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

// The sections that are a position rather than a period. They take no range,
// and since every section is now fetched when it is opened rather than computed
// at first paint, they need a route of their own to arrive through.
export const ANALYTICS_SNAPSHOTS = ["clients", "inventory"] as const;
export type AnalyticsSnapshot = (typeof ANALYTICS_SNAPSHOTS)[number];

export type AnalyticsPanel = AnalyticsSection | AnalyticsSnapshot;

// Validates the /api/analytics query. A boxable section must carry an inclusive,
// correctly-ordered range; a snapshot must not be given one, which is what
// keeps "the clients section for last March" from looking like a real request.
export const analyticsPanelQuerySchema = z.union([
  z
    .object({
      section: z.enum(ANALYTICS_SECTIONS),
      from: dateString,
      to: dateString,
    })
    .refine((d) => d.from <= d.to, {
      message: "from must be on or before to",
      path: ["from"],
    }),
  z.object({ section: z.enum(ANALYTICS_SNAPSHOTS) }),
]);

export type AnalyticsPanelQuery = z.infer<typeof analyticsPanelQuerySchema>;

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
