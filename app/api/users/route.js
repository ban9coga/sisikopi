import { createUserRecord, listUsers } from "@/lib/supabase/repository";
import { isSupabaseServerEnabled } from "@/lib/supabase/server";
import { jsonError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const users = await listUsers();
    return jsonOk({ users });
  } catch (error) {
    return jsonError(error.message || "Akun gagal dimuat.");
  }
}

export async function POST(request) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const body = await request.json();
    await createUserRecord(body);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Akun gagal ditambahkan.");
  }
}
