import { Prisma } from "@/generated/prisma/client";
import { toDateOnly } from "@/utils/format";
import type { RunningCostDTO } from "@/types/entities";

// Include the creator so the list can show who logged each cost.
export const runningCostInclude = {
  creator: { select: { firstName: true, lastName: true } },
} as const;

type RunningCostRow = Prisma.RunningCostGetPayload<{
  include: typeof runningCostInclude;
}>;

export function toRunningCostDTO(c: RunningCostRow): RunningCostDTO {
  return {
    costId: c.costId,
    category: c.category,
    description: c.description,
    amount: c.amount.toString(),
    incurredOn: toDateOnly(c.incurredOn) ?? "",
    notes: c.notes,
    createdByName: c.creator
      ? `${c.creator.firstName} ${c.creator.lastName}`
      : null,
    createdAt: c.createdAt.toISOString(),
  };
}
