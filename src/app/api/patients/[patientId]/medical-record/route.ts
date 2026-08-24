import { NextResponse } from "next/server";
import { ApiError, handle, parseId, requirePermission } from "@/lib/api";
import { getMedicalRecord } from "@/lib/medical-record";

// The assembled medical record, used by the in-app "Download record" button to
// render the same PDF the client is sent.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  return handle(async () => {
    await requirePermission("clinical:read");
    const { patientId } = await params;
    const id = parseId(patientId, "patient id");

    const record = await getMedicalRecord(id);
    if (!record) throw new ApiError(404, "Patient not found");

    return NextResponse.json({ record });
  });
}
