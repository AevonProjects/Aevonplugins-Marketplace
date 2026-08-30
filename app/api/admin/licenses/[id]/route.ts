import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  let body: { status?: string; resetActivation?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!["active", "suspended", "revoked"].includes(body.status)) return NextResponse.json({ error: "Invalid license status." }, { status: 400 });
    update.status = body.status;
  }
  if (body.resetActivation === true) {
    update.server_id = null;
    update.server_ip = null;
    update.activated_at = null;
    update.last_validated_at = null;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "No changes requested." }, { status: 400 });

  let result = await auth.admin.from("licenses").update(update).eq("id", id).select("id,status,server_id,server_ip,activated_at,last_validated_at").maybeSingle();
  if (result.error && result.error.message.toLowerCase().includes("server_ip")) {
    const fallbackUpdate = { ...update };
    delete fallbackUpdate.server_ip;
    result = await auth.admin.from("licenses").update(fallbackUpdate).eq("id", id).select("id,status,server_id,activated_at,last_validated_at").maybeSingle() as typeof result;
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "License not found." }, { status: 404 });
  return NextResponse.json({ license: { ...result.data, server_ip: (result.data as any).server_ip ?? null } });
}
