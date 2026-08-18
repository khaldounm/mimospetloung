import { z } from "zod";

// Treat empty/whitespace form values as "absent" so optional fields don't
// fail max-length or format checks on blank input.
export function optionalString(max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );
}

// ISO date string (YYYY-MM-DD or full ISO) -> Date, or undefined when blank.
export const optionalDate = z.preprocess((v) => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  return v;
}, z.coerce.date().optional());
