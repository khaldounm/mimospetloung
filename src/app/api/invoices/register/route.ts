import { NextResponse } from "next/server";
import { ApiError, handle, requirePermission } from "@/lib/api";
import {
  clinicToday,
  earliestRegisterDate,
  getRegisterDay,
} from "@/lib/register";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  return handle(async () => {
    await requirePermission("invoices:read");

    const raw = new URL(request.url).searchParams.get("date")?.trim();
    const date = raw || clinicToday();
    if (!DATE_RE.test(date)) throw new ApiError(400, "Invalid date");

    // The window is enforced here as well as in the dialog: a hand-typed date
    // would otherwise pull a cash summary for any day in the clinic's history.
    if (date > clinicToday()) {
      throw new ApiError(400, "That day has not happened yet");
    }
    if (date < earliestRegisterDate()) {
      throw new ApiError(
        400,
        "The register can only be closed for the last 7 days",
      );
    }

    return NextResponse.json({ register: await getRegisterDay(date) });
  });
}
