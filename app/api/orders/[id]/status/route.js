import { updateOrderStatusRecord } from "@/lib/supabase/repository";
import { isSupabaseServerEnabled } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const body = await request.json();
    const orders = await updateOrderStatusRecord(params.id, body.status);
    return jsonOk({ orders });
  } catch (error) {
    return jsonError(error.message || "Status order gagal diubah.");
  }
}
