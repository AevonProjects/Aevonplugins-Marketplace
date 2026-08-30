import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  let body: { resetActivation?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.resetActivation !== true) {
    return NextResponse.json({ error: "No supported license change was requested." }, { status: 400 });
  }

  // Ownership is enforced server-side. A customer can only reset a license assigned to their own account.
  const { data: owned, error: ownedError } = await auth.admin
    .from("licenses")
    .select("id,status,server_id,server_ip")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 });
  if (!owned) return NextResponse.json({ error: "License not found." }, { status: 404 });

  // Reset never changes suspended/revoked/active status; it only frees the server binding.
  const { data, error } = await auth.admin
    .from("licenses")
    .update({ server_id: null, server_ip: null, activated_at: null, last_validated_at: null })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id,status,server_id,server_ip,activated_at,last_validated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "License not found." }, { status: 404 });

  return NextResponse.json({ license: data }, { headers: { "Cache-Control": "no-store" } });
}
