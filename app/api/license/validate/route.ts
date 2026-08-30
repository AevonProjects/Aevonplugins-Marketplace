import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^AEVN-[A-F0-9]{10}-[A-F0-9]{10}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCTS: Record<string, string> = {
  alicense: "ALicense",
  adiscordall: "ADiscordALL",
  ateam: "ATeam",
};

function fail(message: string, status = 403) {
  return NextResponse.json({ valid: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function normalizeProductName(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+v?\d+(?:\.\d+){1,3}(?:[-+][0-9a-z.-]+)?\s*$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function POST(request: Request) {
  let body: { licenseKey?: string; product?: string; installationId?: string; version?: string };
  try { body = await request.json(); }
  catch { return fail("Invalid validation request.", 400); }

  const licenseKey = String(body.licenseKey || "").trim().toUpperCase();
  const product = normalizeProductName(body.product);
  const installationId = String(body.installationId || "").trim().toLowerCase();
  const version = String(body.version || "").trim().slice(0, 40);
  const displayProduct = PRODUCTS[product];
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
  const observedIp = forwarded.split(",")[0]?.trim().slice(0, 128) || null;

  if (!KEY_RE.test(licenseKey) || !UUID_RE.test(installationId) || !displayProduct) {
    return fail("License is invalid for this product.");
  }

  const admin = getSupabaseAdmin();
  const { data: license, error } = await admin
    .from("licenses")
    .select("id,status,server_id,activated_at,plugin_id,user_id,license_key,plugins(name,slug)")
    .eq("license_key", licenseKey)
    .maybeSingle();

  if (error) return fail("License validation is temporarily unavailable.", 503);
  if (!license) return fail("License is invalid for this product.");
  if (license.status !== "active") return fail(`License status is ${license.status}.`);

  const plugin = Array.isArray(license.plugins) ? license.plugins[0] : license.plugins;
  const pluginName = normalizeProductName((plugin as any)?.name);
  const pluginSlug = normalizeProductName((plugin as any)?.slug);
  if (pluginName !== product && pluginSlug !== product) {
    return fail("License is invalid for this product.");
  }

  let boundServer = String(license.server_id || "").trim().toLowerCase();
  const now = new Date().toISOString();

  if (!boundServer) {
    let activation = await admin
      .from("licenses")
      .update({ server_id: installationId, server_ip: observedIp, activated_at: now, last_validated_at: now })
      .eq("id", license.id)
      .is("server_id", null)
      .select("server_id")
      .maybeSingle();

    // Keep validation working on older databases until the server_ip migration is applied.
    if (activation.error && activation.error.message.toLowerCase().includes("server_ip")) {
      activation = await admin
        .from("licenses")
        .update({ server_id: installationId, activated_at: now, last_validated_at: now })
        .eq("id", license.id)
        .is("server_id", null)
        .select("server_id")
        .maybeSingle();
    }

    if (activation.error) return fail("License activation is temporarily unavailable.", 503);
    if (activation.data?.server_id) {
      boundServer = String(activation.data.server_id).toLowerCase();
    } else {
      const { data: refreshed } = await admin.from("licenses").select("server_id").eq("id", license.id).maybeSingle();
      boundServer = String(refreshed?.server_id || "").toLowerCase();
    }
  }

  if (!boundServer || boundServer !== installationId) {
    return fail("This license is already activated on another server installation.");
  }

  let heartbeat = await admin.from("licenses").update({ last_validated_at: now, server_ip: observedIp }).eq("id", license.id);
  if (heartbeat.error && heartbeat.error.message.toLowerCase().includes("server_ip")) {
    heartbeat = await admin.from("licenses").update({ last_validated_at: now }).eq("id", license.id);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("nickname,display_name,username")
    .eq("id", license.user_id)
    .maybeSingle();
  const ownerName = String(profile?.nickname || profile?.display_name || profile?.username || "Marketplace Customer").trim().slice(0, 80);

  return NextResponse.json({
    valid: true,
    message: "License active.",
    product: displayProduct,
    version,
    activated: true,
    ownerName,
    licenseDisplay: `${licenseKey.slice(0, 10)}••••••${licenseKey.slice(-6)}`,
    serverBinding: "this-server-only",
    checkedAt: now
  }, { headers: { "Cache-Control": "no-store" } });
}
