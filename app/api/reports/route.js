import { getSummaryByRangeRecord } from "@/lib/supabase/repository";
import { isSupabaseServerEnabled } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const { searchParams } = new URL(request.url);
    const summary = await getSummaryByRangeRecord(
      searchParams.get("branchId") || "",
      searchParams.get("startDate"),
      searchParams.get("endDate"),
    );

    return jsonOk({ summary });
  } catch (error) {
    return jsonError(error.message || "Laporan gagal dimuat.");
  }
}
