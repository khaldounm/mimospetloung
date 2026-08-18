import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { runningCostInclude, toRunningCostDTO } from "@/lib/running-cost";
import { writeAudit } from "@/lib/audit";
import { runningCostUpdateSchema } from "@/schemas/running-cost";

async function getCostId(params: Promise<{ costId: string }>) {
  const { costId } = await params;
  const id = Number(costId);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ costId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("costs:write");
    const costId = await getCostId(params);
    const data = await parseBody(request, runningCostUpdateSchema);

    const existing = await prisma.runningCost.findFirst({
      where: { costId, deletedAt: null },
      select: { costId: true },
    });
    if (!existing) throw new ApiError(404, "Running cost not found");

    const cost = await prisma.runningCost.update({
      where: { costId },
      data: {
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.incurredOn !== undefined
          ? { incurredOn: data.incurredOn }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: runningCostInclude,
    });
    await writeAudit(session, {
      action: "update",
      entity: "running_cost",
      entityId: costId,
      changes: data,
    });
    return NextResponse.json({ cost: toRunningCostDTO(cost) });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ costId: string }> },
) {
  return handle(async () => {
    const session = await requirePermission("costs:write");
    const costId = await getCostId(params);

    const existing = await prisma.runningCost.findFirst({
      where: { costId, deletedAt: null },
      select: { costId: true },
    });
    if (!existing) throw new ApiError(404, "Running cost not found");

    // Soft-delete so historical net-profit reports stay reproducible.
    await prisma.runningCost.update({
      where: { costId },
      data: { deletedAt: new Date() },
    });
    await writeAudit(session, {
      action: "delete",
      entity: "running_cost",
      entityId: costId,
      changes: { softDelete: true },
    });
    return NextResponse.json({ ok: true });
  });
}
