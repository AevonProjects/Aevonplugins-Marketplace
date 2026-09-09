import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";
import { internalError } from "@/lib/server/apiError";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.admin
    .from("user_plugins")
    .select("id,access_type,created_at,plugin_id,plugins(id,name,slug,version,description)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return internalError("Could not load your plugin library.", error);
  return NextResponse.json({ items: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
