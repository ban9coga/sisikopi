import {
  createOrderRecord,
  listOrdersByDate,
  listTodayOrders,
} from "@/lib/supabase/repository";
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
    const scope = searchParams.get("scope");
    let orders;

    if (scope === "today") {
      orders = await listTodayOrders(branchId);
    } else {
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      orders = await listOrdersByDate(branchId, startDate, endDate);
    }

    return jsonOk({ orders });
  } catch (error) {
    return jsonError(error.message || "Order gagal dimuat.");
  }
}

export async function POST(request) {
  if (!isSupabaseServerEnabled()) {
    return jsonError("Mode Supabase belum aktif.", 400);
  }

  try {
    const body = await request.json();
    const order = await createOrderRecord(body);
    return jsonOk({ order });
  } catch (error) {
    return jsonError(error.message || "Order gagal dibuat.");
  }
}
