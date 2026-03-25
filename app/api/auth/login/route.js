import { authenticateUser } from "@/lib/supabase/repository";
import { isSupabaseServerEnabled } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const body = await request.json();
    const session = await authenticateUser(
      body.email || "",
      body.password || "",
      body.branchId || "",
    );

    if (!session) {
      return jsonError("Username atau password tidak cocok.", 401);
    }

    return jsonOk({ session });
  } catch (error) {
    return jsonError(error.message || "Login gagal diproses.");
  }
}
