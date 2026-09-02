import { NextResponse } from "next/server";
import { ApiError, handle, requirePermission } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { getClientListExport } from "@/lib/analytics";
import { clientListExportQuerySchema } from "@/schemas/analytics";
import { CURRENCY } from "@/constants/clinic";
import { buildCsv } from "@/utils/csv";
import type { ClientListKind } from "@/schemas/analytics";

// Both lists carry the same columns, so a file is read the same way whichever
// icon produced it. Money is exported as a bare number rather than as "$1,234.56"
// so the column can be summed in the spreadsheet.
const HEADERS = [
  "Client ID",
  "Client",
  "Phone",
  "Email",
  "Last activity",
  "Invoices in period",
  `Billed in period (${CURRENCY.code})`,
  `Billed lifetime (${CURRENCY.code})`,
  `Account balance (${CURRENCY.code})`,
];

function fileName(list: ClientListKind, from: string, to: string): string {
  return `${list === "top" ? "top" : "lapsed"}-clients-${from}-to-${to}.csv`;
}

// Downloads one of the clients section's two lists for the range it is set to.
//
// The list is rebuilt here rather than posted up from the browser: the table on
// screen shows only its first page, and what staff want out of a download is
// every row, not the ten they can already see.
export async function GET(request: Request) {
  return handle(async () => {
    const session = await requirePermission("analytics:read");
    // The file names clients and carries their phone, email and balance, so it
    // follows the permission client records follow everywhere else rather than
    // analytics:read on its own.
    if (!hasPermission(session.user, "patients:read")) {
      throw new ApiError(403, "Forbidden");
    }

    const params = new URL(request.url).searchParams;
    const parsed = clientListExportQuerySchema.safeParse({
      list: params.get("list"),
      from: params.get("from"),
      to: params.get("to"),
    });
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid query",
      );
    }
    const { list, from, to } = parsed.data;

    const rows = await getClientListExport(list, { from, to });
    const csv = buildCsv(
      HEADERS,
      rows.map((r) => [
        r.clientId,
        r.name,
        r.phone,
        r.email,
        // Empty rather than "Never": a blank cell sorts and filters as missing,
        // which is what it is.
        r.lastActivity,
        r.invoices,
        r.billed,
        r.lifetimeBilled,
        r.accountBalance,
      ]),
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName(list, from, to)}"`,
        // A range that ends today reports different rows tomorrow.
        "Cache-Control": "no-store",
      },
    });
  });
}
