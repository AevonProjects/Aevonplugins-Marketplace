import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^AEVN-[A-F0-9]{10}-[A-F0-9]{10}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_RE = /^[a-f0-9]{64}$/;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+v?\d+(?:\.\d+){1,3}.*$/i, "").replace(/[^a-z0-9]/g, "");
}

export async function POST(request: Request) {
  let body: {
    licenseKey?: string;
    product?: string;
    installationId?: string;
    version?: string;
    onlineCount?: number;
    playerHashes?: string[];
  };
  try { body = await request.json(); }
  catch { return json({ accepted: false, error: "Invalid telemetry request." }, 400); }

  const licenseKey = String(body.licenseKey || "").trim().toUpperCase();
  const product = normalize(body.product);
  const installationId = String(body.installationId || "").trim().toLowerCase();
  const version = String(body.version || "").trim().slice(0, 40);
  const onlineCount = Math.max(0, Math.min(100000, Number(body.onlineCount || 0) || 0));
  const playerHashes = Array.from(new Set((Array.isArray(body.playerHashes) ? body.playerHashes : [])
    .map((v) => String(v || "").trim().toLowerCase())
    .filter((v) => HASH_RE.test(v))))
    .slice(0, 2000);

  if (!KEY_RE.test(licenseKey) || !UUID_RE.test(installationId) || product !== "adiscordall") {
    return json({ accepted: false, error: "Telemetry credentials are invalid." }, 403);
  }

  const admin = getSupabaseAdmin();
  const { data: license, error } = await admin
    .from("licenses")
    .select("id,status,server_id,plugin_id,plugins(name,slug)")
    .eq("license_key", licenseKey)
    .maybeSingle();

  if (error) return json({ accepted: false, error: "Telemetry service unavailable." }, 503);
  if (!license || license.status !== "active") return json({ accepted: false, error: "License is not active." }, 403);

  const plugin = Array.isArray(license.plugins) ? license.plugins[0] : license.plugins;
  const pluginName = normalize((plugin as any)?.name);
  const pluginSlug = normalize((plugin as any)?.slug);
  if (pluginName !== "adiscordall" && pluginSlug !== "adiscordall") {
    return json({ accepted: false, error: "License is not for ADiscordALL." }, 403);
  }

  if (String(license.server_id || "").trim().toLowerCase() !== installationId) {
    return json({ accepted: false, error: "License is not activated on this server." }, 403);
  }

  const now = new Date().toISOString();
  const usageDate = now.slice(0, 10);

  const { error: serverError } = await admin.from("adiscordall_server_usage").upsert({
    license_id: license.id,
    server_id: installationId,
    plugin_version: version || null,
    last_seen_at: now,
    last_online_count: onlineCount,
  }, { onConflict: "license_id,server_id" });
  if (serverError) return json({ accepted: false, error: "Could not save server usage." }, 503);

  await admin.from("adiscordall_daily_servers").upsert({
    usage_date: usageDate,
    license_id: license.id,
    server_id: installationId,
    plugin_version: version || null,
    online_count: onlineCount,
    last_seen_at: now,
  }, { onConflict: "usage_date,server_id" });

  if (playerHashes.length) {
    const rows = playerHashes.map((player_hash) => ({
      usage_date: usageDate,
      license_id: license.id,
      server_id: installationId,
      player_hash,
      last_seen_at: now,
    }));
    await admin.from("adiscordall_daily_players").upsert(rows, { onConflict: "usage_date,server_id,player_hash" });
  }

  return json({ accepted: true, checkedAt: now });
}
