import { z } from "zod";

export const settingsUpdateSchema = z.object({
  // LBP per 1 USD. Bounded well either side of the peg so a slipped keystroke
  // (89.5 or 8,950,000) is rejected rather than silently repricing the till.
  fxUsdLbp: z.coerce.number().min(1_000).max(10_000_000),
});

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
