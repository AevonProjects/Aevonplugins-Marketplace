import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";
import { internalError } from "@/lib/server/apiError";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const pluginId = String(url.searchParams.get("pluginId") || "").trim();

  if (!pluginId) {
    const { data, error } = await auth.admin
      .from("user_plugins")
      .select("plugin_id")
      .eq("user_id", auth.user.id)
      .eq("access_type", "purchase");

    if (error) return internalError("Could not load account ownership.", error);
    return NextResponse.json({ pluginIds: (data || []).map((x: any) => String(x.plugin_id)) }, { headers: { "Cache-Control": "no-store" } });
  }

  const [{ data: access, error: accessError }, { data: license, error: licenseError }] = await Promise.all([
    auth.admin.from("user_plugins")
      .select("id,access_type,created_at")
      .eq("user_id", auth.user.id)
      .eq("plugin_id", pluginId)
      .maybeSingle(),
    auth.admin.from("licenses")
      .select("id,license_key,status,download_count,last_download_at,created_at")
      .eq("user_id", auth.user.id)
      .eq("plugin_id", pluginId)
      .maybeSingle()
  ]);

  if (accessError || licenseError) return internalError("Could not load account ownership.", accessError || licenseError);
  return NextResponse.json({ access: access || null, license: license || null }, { headers: { "Cache-Control": "no-store" } });
}
