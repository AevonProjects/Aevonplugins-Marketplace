import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const admin = getSupabaseAdmin();

    const { data: plugin, error: pluginError } = await admin
      .from("plugins")
      .select("id,status")
      .eq("id", id)
      .maybeSingle();

    if (pluginError || !plugin || plugin.status !== "published") {
      return NextResponse.json({ error: "Plugin not found." }, { status: 404 });
    }

    const { data: licenses, error } = await admin
      .from("licenses")
      .select("download_count")
      .eq("plugin_id", id);

    if (error) {
      console.error("Failed to count plugin downloads:", error);
      return NextResponse.json({ error: "Download count is temporarily unavailable." }, { status: 503 });
    }

    const totalDownloads = (licenses ?? []).reduce((sum, row: any) => {
      const value = Number(row?.download_count ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    return NextResponse.json(
      { totalDownloads },
      { headers: { "Cache-Control": "public, max-age=15, s-maxage=30" } }
    );
  } catch (error) {
    console.error("Download count endpoint failed:", error);
    return NextResponse.json({ error: "Download count is temporarily unavailable." }, { status: 503 });
  }
}
