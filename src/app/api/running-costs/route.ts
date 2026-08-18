import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, parseBody, requirePermission } from "@/lib/api";
import { runningCostInclude, toRunningCostDTO } from "@/lib/running-cost";
import { writeAudit } from "@/lib/audit";
import { runningCostCreateSchema } from "@/schemas/running-cost";

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("costs:read");

    const sp = new URL(request.url).searchParams;
    const q = sp.get("q")?.trim();
    const category = sp.get("category")?.trim();
    const from = sp.get("from")?.trim();
    const to = sp.get("to")?.trim();

    const costs = await prisma.runningCost.findMany({
      where: {
        deletedAt: null,
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { description: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(from || to
          ? {
              incurredOn: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: runningCostInclude,
      orderBy: [{ incurredOn: "desc" }, { costId: "desc" }],
    });

    return NextResponse.json({ costs: costs.map(toRunningCostDTO) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("costs:write");
    const data = await parseBody(request, runningCostCreateSchema);

    const cost = await prisma.runningCost.create({
      data: {
        category: data.category,
        description: data.description,
        amount: data.amount,
        incurredOn: data.incurredOn,
        notes: data.notes,
        createdBy: session.user.userId ?? null,
      },
      include: runningCostInclude,
    });
    await writeAudit(session, {
      action: "create",
      entity: "running_cost",
      entityId: cost.costId,
      changes: data,
    });
    return NextResponse.json({ cost: toRunningCostDTO(cost) }, { status: 201 });
  });
}
