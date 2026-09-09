import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const revalidate = 60;

export async function GET() {
  const admin = getSupabaseAdmin();
  const { data: plugins, error } = await admin
    .from("plugins")
    .select("id,name,slug,description,version,price,status,profile_image_url,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Marketplace load failed:", error);
    return NextResponse.json({ error: "Marketplace is temporarily unavailable." }, { status: 503 });
  }

  const rows = plugins || [];
  let latestByPlugin = new Map<string, string>();

  if (rows.length) {
    const { data: versions, error: versionsError } = await admin
      .from("plugin_versions")
      .select("plugin_id,version")
      .in("plugin_id", rows.map((p: any) => p.id))
      .eq("is_latest", true)
      .eq("is_published", true);

    if (!versionsError) {
      latestByPlugin = new Map((versions || []).map((v: any) => [String(v.plugin_id), String(v.version || "").trim()]));
    }
  }

  const response = NextResponse.json({
    plugins: rows.map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      version: latestByPlugin.get(String(p.id)) || p.version,
      price: p.price,
      status: p.status,
      profile_image_url: p.profile_image_url
    }))
  });
  response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return response;
}
