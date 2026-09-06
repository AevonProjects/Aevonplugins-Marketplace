import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  const { data: order } = await auth.admin.from("marketplace_orders").select("id,status").eq("id", id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status === "pending") return NextResponse.json({ error: "Pending orders cannot be removed from history. Approve or reject it first." }, { status: 409 });

  const { error } = await auth.admin.from("marketplace_orders").update({ admin_hidden: true, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
