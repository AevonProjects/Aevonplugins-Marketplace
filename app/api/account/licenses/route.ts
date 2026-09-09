import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";
import { internalError } from "@/lib/server/apiError";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let result = await auth.admin
    .from("licenses")
    .select("id,license_key,status,download_count,last_download_at,server_id,server_ip,activated_at,last_validated_at,plugins(name,version)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (result.error && String(result.error.message || "").toLowerCase().includes("server_ip")) {
    result = await auth.admin
      .from("licenses")
      .select("id,license_key,status,download_count,last_download_at,server_id,activated_at,last_validated_at,plugins(name,version)")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });
  }

  if (result.error) return internalError("Could not load your licenses.", result.error);
  return NextResponse.json({ licenses: result.data || [] }, { headers: { "Cache-Control": "no-store" } });
}
