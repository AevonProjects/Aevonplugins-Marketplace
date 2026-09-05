import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ack = { orderId?: string; status?: string; message?: string };
type Player = { name?: string; uuid?: string };

export async function POST(request: Request) {
  const expected = process.env.AEVONSMP_BRIDGE_SECRET;
  const got = request.headers.get("x-aevonsmp-secret");
  if (!expected || !got || got !== expected) return NextResponse.json({ error: "Unauthorized bridge." }, { status: 401 });

  let body: { serverId?: string; serverName?: string; serverAddress?: string; playersMax?: number; minecraftVersion?: string; pluginVersion?: string; players?: Player[]; acknowledgements?: Ack[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const admin = getSupabaseAdmin();
  const serverId = String(body.serverId || "aevonsmp-main").slice(0, 100);
  const players = Array.isArray(body.players) ? body.players.filter(p => p?.name).slice(0, 500) : [];
  const names = players.map(p => String(p.name));
  const now = new Date(); const nowIso = now.toISOString();

  for (const ack of Array.isArray(body.acknowledgements) ? body.acknowledgements : []) {
    const orderId = String(ack.orderId || ""); if (!orderId) continue;
    const status = String(ack.status || "");
    const update: Record<string, unknown> = { updated_at: nowIso, delivery_message: String(ack.message || "").slice(0, 500) || null };
    if (status === "delivered") { update.delivery_status = "delivered"; update.delivered_at = nowIso; }
    else if (status === "waiting_inventory") update.delivery_status = "waiting_inventory";
    else if (status === "waiting_player") update.delivery_status = "waiting_player";
    else if (status === "failed") update.delivery_status = "failed";
    else continue;
    await admin.from("aevonsmp_orders").update(update).eq("id", orderId);
  }

  await admin.from("aevonsmp_server_status").upsert({
    server_id: serverId,
    server_name: String(body.serverName || "AevonSMP").slice(0, 100),
    server_address: String(body.serverAddress || "aevonsmp.online").slice(0, 200),
    online: true,
    players_online: names.length,
    players_max: Math.max(0, Number(body.playersMax || 0)),
    player_names: names,
    minecraft_version: String(body.minecraftVersion || "").slice(0, 100) || null,
    plugin_version: String(body.pluginVersion || "").slice(0, 50) || null,
    last_seen_at: nowIso,
  }, { onConflict: "server_id" });

  // Recover a claim if a server died before it could acknowledge it.
  const staleIso = new Date(now.getTime() - 120_000).toISOString();
  await admin.from("aevonsmp_orders").update({ delivery_status: "payment_confirmed", claimed_at: null, updated_at: nowIso }).eq("delivery_status", "processing").lt("claimed_at", staleIso);

  if (!names.length) return NextResponse.json({ orders: [] });
  const lowerNames = names.map(n => n.toLowerCase());
  const { data: candidates, error } = await admin.from("aevonsmp_orders")
    .select("id,order_code,product_name,minecraft_ign,quantity,reward_command,command_mode,required_free_slots,delivery_status")
    .in("delivery_status", ["payment_confirmed", "waiting_player", "waiting_inventory"])
    .order("created_at", { ascending: true }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const matching = (candidates || []).filter(o => lowerNames.includes(String(o.minecraft_ign).toLowerCase())).slice(0, 25);
  const claimed = [];
  for (const order of matching) {
    const { data } = await admin.from("aevonsmp_orders")
      .update({ delivery_status: "processing", claimed_at: nowIso, updated_at: nowIso })
      .eq("id", order.id).in("delivery_status", ["payment_confirmed", "waiting_player", "waiting_inventory"])
      .select("id").maybeSingle();
    if (data) claimed.push(order);
  }
  return NextResponse.json({ orders: claimed });
}
