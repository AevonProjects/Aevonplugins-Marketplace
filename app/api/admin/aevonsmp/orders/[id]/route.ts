import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";
import { deleteGcashTicketForOrder } from "@/lib/server/gcashTickets";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  const { data: order } = await auth.admin.from("aevonsmp_orders").select("id,payment_status").eq("id", id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_status === "pending") return NextResponse.json({ error: "Pending orders cannot be removed from history. Approve or reject it first." }, { status: 409 });

  const { error } = await auth.admin.from("aevonsmp_orders").update({ admin_hidden: true, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try { await deleteGcashTicketForOrder(auth.admin, "aevonsmp", id); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Order hidden but linked ticket could not be deleted." }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
