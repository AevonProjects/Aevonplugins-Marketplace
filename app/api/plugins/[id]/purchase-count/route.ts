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

    const { count, error } = await admin
      .from("user_plugins")
      .select("id", { count: "exact", head: true })
      .eq("plugin_id", id)
      .eq("access_type", "purchase");

    if (error) {
      console.error("Failed to count plugin purchases:", error);
      return NextResponse.json({ error: "Purchase count is temporarily unavailable." }, { status: 503 });
    }

    return NextResponse.json(
      { totalPurchased: count ?? 0 },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } }
    );
  } catch (error) {
    console.error("Purchase count endpoint failed:", error);
    return NextResponse.json({ error: "Purchase count is temporarily unavailable." }, { status: 503 });
  }
}
