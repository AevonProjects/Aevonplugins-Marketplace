import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^AEVN-[A-F0-9]{10}-[A-F0-9]{10}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status = 403) {
  return NextResponse.json({ valid: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { licenseKey?: string; product?: string; installationId?: string; version?: string };
  try { body = await request.json(); }
  catch { return fail("Invalid validation request.", 400); }

  const licenseKey = String(body.licenseKey || "").trim().toUpperCase();
  const product = String(body.product || "").trim().toLowerCase();
  const installationId = String(body.installationId || "").trim().toLowerCase();
  const version = String(body.version || "").trim().slice(0, 40);

  if (!KEY_RE.test(licenseKey) || !UUID_RE.test(installationId) || product !== "alicense") {
    return fail("License is invalid for this product.");
  }

  const admin = getSupabaseAdmin();
  const { data: license, error } = await admin
    .from("licenses")
    .select("id,status,server_id,activated_at,plugin_id,plugins(name,slug)")
    .eq("license_key", licenseKey)
    .maybeSingle();

  if (error) return fail("License validation is temporarily unavailable.", 503);
  if (!license) return fail("License is invalid for this product.");
  if (license.status !== "active") return fail(`License status is ${license.status}.`);

  const plugin = Array.isArray(license.plugins) ? license.plugins[0] : license.plugins;
  const pluginName = String((plugin as any)?.name || "").trim().toLowerCase();
  const pluginSlug = String((plugin as any)?.slug || "").trim().toLowerCase();
  if (pluginName !== "alicense" && pluginSlug !== "alicense") {
    return fail("License is invalid for this product.");
  }

  let boundServer = String(license.server_id || "").trim().toLowerCase();
  const now = new Date().toISOString();

  if (!boundServer) {
    const { data: activated, error: activationError } = await admin
      .from("licenses")
      .update({ server_id: installationId, activated_at: now, last_validated_at: now })
      .eq("id", license.id)
      .is("server_id", null)
      .select("server_id")
      .maybeSingle();

    if (activationError) return fail("License activation is temporarily unavailable.", 503);
    if (activated?.server_id) {
      boundServer = String(activated.server_id).toLowerCase();
    } else {
      const { data: refreshed } = await admin.from("licenses").select("server_id").eq("id", license.id).maybeSingle();
      boundServer = String(refreshed?.server_id || "").toLowerCase();
    }
  }

  if (!boundServer || boundServer !== installationId) {
    return fail("This license is already activated on another server installation.");
  }

  await admin.from("licenses").update({ last_validated_at: now }).eq("id", license.id);

  return NextResponse.json({
    valid: true,
    message: "License active.",
    product: "ALicense",
    version,
    activated: true,
    checkedAt: now
  }, { headers: { "Cache-Control": "no-store" } });
}
