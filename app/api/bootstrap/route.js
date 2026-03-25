import { ensureSeedData } from "@/lib/supabase/repository";
import { isSupabaseServerEnabled } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isSupabaseServerEnabled()) {
    return jsonOk({ seeded: false, mode: "local" });
  }

  try {
    await ensureSeedData();
    return jsonOk({ seeded: true, mode: "supabase" });
  } catch (error) {
    return jsonError(error.message || "Gagal menyiapkan data Supabase.");
  }
}
