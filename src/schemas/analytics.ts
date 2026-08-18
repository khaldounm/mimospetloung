import { z } from "zod";

// The analytics sections that can be re-queried for a custom date range. The
// snapshot sections (clients, inventory) are not time-boxed and so are not here.
export const ANALYTICS_SECTIONS = [
  "revenue",
  "profit",
  "purchases",
  "bookings",
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
