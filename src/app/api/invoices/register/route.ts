import { NextResponse } from "next/server";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import {
  clinicToday,
  earliestRegisterDate,
  getRegisterDay,
  saveRegisterClosing,
} from "@/lib/register";
import { registerCloseSchema } from "@/schemas/register";
import { writeAudit } from "@/lib/audit";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The window a register can be closed for. Enforced here as well as in the
// dialog: a hand-typed date would otherwise reach back into any day in the
// clinic's history, and closing the books on a day from last year is not a
// thing anyone standing at the counter is doing on purpose.
function assertClosableDate(date: string): void {
  if (!DATE_RE.test(date)) throw new ApiError(400, "Invalid date");
  if (date > clinicToday()) {
    throw new ApiError(400, "That day has not happened yet");
  }
  if (date < earliestRegisterDate()) {
    throw new ApiError(
      400,
      "The register can only be closed for the last 7 days",
    );
  }
}

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("invoices:read");

    const raw = new URL(request.url).searchParams.get("date")?.trim();
    const date = raw || clinicToday();
    assertClosableDate(date);

    return NextResponse.json({ register: await getRegisterDay(date) });
  });
}

// File the day's count.
//
// Gated on invoices:write, not costs:write. Closing the register is the
// receptionist's last job of the day and they have no business managing the
// clinic's cost ledger, but the cash they hand out of the till is an operating
// cost all the same: the grant that lets them take money at the counter is the
// one that lets them account for what left it.
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePermission("invoices:write");
    const data = await parseBody(request, registerCloseSchema);
    assertClosableDate(data.date);

    const closing = await saveRegisterClosing(
      data,
      session.user.userId ?? null,
    );

    await writeAudit(session, {
      action: "close",
      entity: "register_closing",
      entityId: closing.closingId,
      changes: {
        date: closing.date,
        countedUsd: closing.countedUsd,
        countedLbp: closing.countedLbp,
        expectedUsd: closing.expectedUsd,
        expectedLbp: closing.expectedLbp,
        varianceUsd: closing.varianceUsd,
        payouts: closing.payouts.length,
      },
    });

    return NextResponse.json({ closing });
  });
}
