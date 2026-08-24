import { NextResponse } from "next/server";
import { ApiError, handle, parseBody, requirePermission } from "@/lib/api";
import { toInvoiceDTO } from "@/lib/invoices";
import { addReturnLines } from "@/lib/returns";
import { returnCreateSchema } from "@/schemas/invoice";
import { writeAudit } from "@/lib/audit";

// Add return lines to THIS invoice, which must be a draft. The lines being given
// back belong to other, already-issued invoices; this one is the document the
// customer walks away with, and it can hold goods going out on the same visit,
// which is how an exchange is rung up.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  return handle(async () => {
    // Same gate as issuing. A return moves money, and the roles that hold this
    // are Admin and Receptionist, which is who stands at the counter.
    const session = await requirePermission("invoices:write");
    const { invoiceId } = await params;
    const id = Number(invoiceId);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");

    const data = await parseBody(request, returnCreateSchema);
    const invoice = await addReturnLines(id, data.entries);

    await writeAudit(session, {
      action: "return",
      entity: "invoice",
      entityId: id,
      changes: {
        entries: data.entries.map((e) => ({
          sourceLineItemId: e.sourceLineItemId,
          quantity: e.quantity,
          restock: e.restock,
        })),
        total: invoice.total.toString(),
      },
    });

    return NextResponse.json(
      { invoice: toInvoiceDTO(invoice) },
      { status: 201 },
    );
  });
}
