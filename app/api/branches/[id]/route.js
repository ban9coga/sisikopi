import { deleteBranchRecord, updateBranchRecord } from "@/lib/supabase/repository";
import { isSupabaseServerEnabled } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function PATCH(request, context) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    await updateBranchRecord(id, body);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Cabang gagal diperbarui.");
  }
}

export async function DELETE(_request, context) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const { id } = await context.params;
    await deleteBranchRecord(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Cabang gagal dihapus.");
  }
}
