import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeProductName(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+v?\d+(?:\.\d+){1,3}(?:[-+][0-9a-z.-]+)?\s*$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = normalizeProductName(url.searchParams.get("product"));
  const currentVersion = String(url.searchParams.get("current") || "").trim().slice(0, 40);

  if (!requested) return json({ error: "Missing product." }, 400);

  const admin = getSupabaseAdmin();
  const { data: plugins, error: pluginError } = await admin
    .from("plugins")
    .select("id,name,slug,version,status")
    .eq("status", "published");

  if (pluginError) return json({ error: "Update service temporarily unavailable." }, 503);

  const plugin = (plugins || []).find((row: any) => {
    return normalizeProductName(row?.name) === requested || normalizeProductName(row?.slug) === requested;
  });

  if (!plugin) return json({ error: "Plugin not found." }, 404);

  const { data: latestRelease, error: releaseError } = await admin
    .from("plugin_versions")
    .select("version,release_type,changelog,created_at,is_latest")
    .eq("plugin_id", plugin.id)
    .eq("is_published", true)
    .eq("is_latest", true)
    .maybeSingle();

  // Older installations may not have plugin_versions populated yet. In that
  // case the plugin row's version remains a safe public fallback.
  if (releaseError) {
    const message = String(releaseError.message || "").toLowerCase();
    if (!message.includes("plugin_versions") && !message.includes("is_published")) {
      return json({ error: "Update service temporarily unavailable." }, 503);
    }
  }

  const latestVersion = String(latestRelease?.version || plugin.version || "").trim();
  if (!latestVersion) return json({ error: "No published version is available." }, 404);

  return json({
    product: plugin.name,
    slug: plugin.slug,
    currentVersion: currentVersion || null,
    latestVersion,
    releaseType: latestRelease?.release_type || "stable",
    changelog: latestRelease?.changelog || null,
    publishedAt: latestRelease?.created_at || null,
    marketplace: "Aevon Marketplace",
  });
}
