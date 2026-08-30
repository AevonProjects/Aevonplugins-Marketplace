import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  let body: { resetActivation?: boolean };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  if (body.resetActivation !== true) return NextResponse.json({ error: "No supported license change was requested." }, { status: 400 });

  let ownedResult = await auth.admin.from("licenses").select("id,status,server_id,server_ip").eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (ownedResult.error && ownedResult.error.message.toLowerCase().includes("server_ip")) {
    ownedResult = await auth.admin.from("licenses").select("id,status,server_id").eq("id", id).eq("user_id", auth.user.id).maybeSingle() as typeof ownedResult;
  }
  if (ownedResult.error) return NextResponse.json({ error: ownedResult.error.message }, { status: 500 });
  if (!ownedResult.data) return NextResponse.json({ error: "License not found." }, { status: 404 });

  const update: Record<string, unknown> = { server_id: null, server_ip: null, activated_at: null, last_validated_at: null };
  let result = await auth.admin.from("licenses").update(update).eq("id", id).eq("user_id", auth.user.id).select("id,status,server_id,server_ip,activated_at,last_validated_at").maybeSingle();
  if (result.error && result.error.message.toLowerCase().includes("server_ip")) {
    delete update.server_ip;
    result = await auth.admin.from("licenses").update(update).eq("id", id).eq("user_id", auth.user.id).select("id,status,server_id,activated_at,last_validated_at").maybeSingle() as typeof result;
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "License not found." }, { status: 404 });

  return NextResponse.json({ license: { ...result.data, server_ip: (result.data as any).server_ip ?? null } }, { headers: { "Cache-Control": "no-store" } });
}
