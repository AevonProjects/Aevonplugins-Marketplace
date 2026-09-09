import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";
import { internalError } from "@/lib/server/apiError";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.admin
    .from("marketplace_orders")
    .select("id,order_code,customer_email,amount,currency,payment_method,status,created_at,plugin_id,plugins(name)")
    .eq("payment_method", "gcash")
    .eq("admin_hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return internalError("Could not load payment orders.", error);
  return NextResponse.json({ orders: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
