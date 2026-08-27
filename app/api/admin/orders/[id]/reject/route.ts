import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  let note = "";
  try { const body = await request.json(); note = String(body?.note || "").trim().slice(0, 500); } catch {}

  const { data: order } = await auth.admin.from("marketplace_orders").select("id,status").eq("id", id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "pending") return NextResponse.json({ error: `Order is ${order.status} and cannot be rejected.` }, { status: 409 });

  const now = new Date().toISOString();
  const { error } = await auth.admin.from("marketplace_orders").update({
    status: "rejected",
    admin_note: note || null,
    reviewed_at: now,
    reviewed_by: auth.user.id,
    updated_at: now
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
