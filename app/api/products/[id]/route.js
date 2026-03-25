import {
  deleteProductRecord,
  updateProductRecord,
} from "@/lib/supabase/repository";
import { isSupabaseServerEnabled } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const body = await request.json();
    await updateProductRecord(params.id, body);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Produk gagal diperbarui.");
  }
}

export async function DELETE(_request, { params }) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    await deleteProductRecord(params.id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Produk gagal dihapus.");
  }
}
