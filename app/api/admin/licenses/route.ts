import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: licenses, error } = await auth.admin
    .from("licenses")
    .select("id,user_id,plugin_id,license_key,status,server_id,server_ip,activated_at,last_validated_at,download_count,last_download_at,created_at,plugins(name,slug,version)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = Array.from(new Set((licenses || []).map((l: any) => l.user_id).filter(Boolean)));
  const { data: profiles } = userIds.length
    ? await auth.admin.from("profiles").select("id,nickname,display_name,username,verification_status").in("id", userIds)
    : { data: [] as any[] };
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  const emailEntries = await Promise.all(userIds.map(async (userId) => {
    try {
      const { data } = await auth.admin.auth.admin.getUserById(userId);
      return [userId, data.user?.email || ""] as const;
    } catch { return [userId, ""] as const; }
  }));
  const emailMap = new Map(emailEntries);

  return NextResponse.json({ licenses: (licenses || []).map((l: any) => {
    const profile = profileMap.get(l.user_id) || {};
    const plugin = Array.isArray(l.plugins) ? l.plugins[0] : l.plugins;
    return {
      ...l,
      customer_email: emailMap.get(l.user_id) || "",
      customer_name: profile.nickname || profile.display_name || profile.username || "",
      plugin_name: plugin?.name || "",
      plugin_version: plugin?.version || "",
      user: { id: l.user_id, email: emailMap.get(l.user_id) || "", ...profile }
    };
  }) }, { headers: { "Cache-Control": "no-store" } });
}
