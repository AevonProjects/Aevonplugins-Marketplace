import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.admin
    .from("gcash_tickets")
    .select("id,order_kind,order_id,order_code,customer_email,product_name,amount,subject,status,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ tickets: data || [] });
}
