import { createBranchRecord, listBranches } from "@/lib/supabase/repository";
import { isSupabaseServerEnabled } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const branches = await listBranches();
    return jsonOk({ branches });
  } catch (error) {
    return jsonError(error.message || "Cabang gagal dimuat.");
  }
}

export async function POST(request) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const body = await request.json();
    await createBranchRecord(body);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Cabang gagal ditambahkan.");
  }
}
