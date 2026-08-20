import { NextResponse } from "next/server";
import { handle, parseBody, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { getFxRate, setSetting, SETTING_KEYS } from "@/lib/settings";
import { settingsUpdateSchema } from "@/schemas/settings";

export async function GET() {
  return handle(async () => {
    await requirePermission("users:write");
    return NextResponse.json({ fxUsdLbp: String(await getFxRate()) });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const session = await requirePermission("users:write");
    const data = await parseBody(request, settingsUpdateSchema);

    const previous = await getFxRate();
    await setSetting(
      SETTING_KEYS.fxUsdLbp,
      String(data.fxUsdLbp),
      session.user.userId,
    );

    // The rate decides what every lira taken at the counter is worth, so a
    // change to it is worth as much of a trail as a payment.
    await writeAudit(session, {
      action: "update",
      entity: "setting",
      // Settings are keyed by name, not by a numeric id; 0 stands in so the
      // column stays non-null and the key travels in the payload.
      entityId: 0,
      changes: {
        key: SETTING_KEYS.fxUsdLbp,
        from: String(previous),
        to: String(data.fxUsdLbp),
      },
    });

    return NextResponse.json({ fxUsdLbp: String(data.fxUsdLbp) });
  });
}
