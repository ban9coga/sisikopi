import { createProductRecord, listProducts } from "@/lib/supabase/repository";
import { isSupabaseServerEnabled } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || "";
    const products = await listProducts(branchId);
    return jsonOk({ products });
  } catch (error) {
    return jsonError(error.message || "Produk gagal dimuat.");
  }
}

export async function POST(request) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const body = await request.json();
    await createProductRecord(body);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Produk gagal ditambahkan.");
  }
}
