import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+v?\d+(?:\.\d+){1,3}.*$/i, "").replace(/[^a-z0-9]/g, "");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const { data: plugin } = await admin.from("plugins").select("id,name,slug,status").eq("id", id).maybeSingle();
  if (!plugin || plugin.status !== "published") {
    return NextResponse.json({ error: "Usage statistics are not available for this plugin." }, { status: 404 });
  }

  const identity = normalize(plugin.slug) || normalize(plugin.name);
  const isALicense = identity === "alicense" || normalize(plugin.name) === "alicense";
  const isADiscordALL = identity === "adiscordall" || normalize(plugin.name) === "adiscordall";
  if (!isALicense && !isADiscordALL) {
    return NextResponse.json({ error: "Usage statistics are not available for this plugin." }, { status: 404 });
  }

  const statsRpc = isALicense ? "get_alicense_usage_stats" : "get_adiscordall_usage_stats";
  const totalsRpc = isALicense ? "get_alicense_usage_totals" : "get_adiscordall_usage_totals";
  const product = isALicense ? "ALicense" : "ADiscordALL";

  const [{ data: totals, error: totalsError }, { data: series, error: seriesError }] = await Promise.all([
    admin.rpc(totalsRpc),
    admin.rpc(statsRpc, { days_back: 30 }),
  ]);

  if (totalsError || seriesError) {
    return NextResponse.json({ error: "Usage statistics are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const t = Array.isArray(totals) ? totals[0] : totals;
  return NextResponse.json({
    product,
    totals: {
      totalServers: Number(t?.total_servers || 0),
      activeServers: Number(t?.active_servers || 0),
      uniquePlayers: Number(t?.unique_players || 0),
    },
    series: (series || []).map((row: any) => ({
      date: row.usage_date,
      servers: Number(row.servers || 0),
      players: Number(row.players || 0),
    })),
    activeWindowDays: 7,
  }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
}
