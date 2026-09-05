import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = getSupabaseAdmin();
  const [{ data: products, error }, { data: status }] = await Promise.all([
    admin.from("aevonsmp_products").select("id,name,description,price,max_quantity,image_url,status,sort_order").eq("status", "published").order("sort_order").order("created_at"),
    admin.from("aevonsmp_server_status").select("server_name,server_address,online,players_online,players_max,player_names,minecraft_version,last_seen_at").order("last_seen_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const fresh = status && Date.now() - new Date(status.last_seen_at).getTime() < 30_000;
  return NextResponse.json({ products: products || [], server: status ? { ...status, online: Boolean(status.online && fresh), player_names: fresh ? status.player_names : [], players_online: fresh ? status.players_online : 0 } : null }, { headers: { "Cache-Control": "no-store" } });
}
