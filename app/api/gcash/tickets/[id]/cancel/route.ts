import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  const { data: ticket } = await auth.admin
    .from("gcash_tickets")
    .select("id,user_id,order_kind,order_id,status")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (ticket.status !== "open") return NextResponse.json({ error: `This ticket is ${ticket.status} and can no longer be cancelled.` }, { status: 409 });

  if (ticket.order_kind === "marketplace") {
    const { data: order } = await auth.admin.from("marketplace_orders").select("id,status").eq("id", ticket.order_id).maybeSingle();
    if (!order || order.status !== "pending") return NextResponse.json({ error: "This purchase is no longer pending." }, { status: 409 });
    const { error } = await auth.admin.from("marketplace_orders").update({
      status: "cancelled", admin_note: "Cancelled by buyer from GCash ticket.", updated_at: new Date().toISOString()
    }).eq("id", ticket.order_id).eq("status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data: order } = await auth.admin.from("aevonsmp_orders").select("id,payment_status").eq("id", ticket.order_id).maybeSingle();
    if (!order || order.payment_status !== "pending") return NextResponse.json({ error: "This purchase is no longer pending." }, { status: 409 });
    const { error } = await auth.admin.from("aevonsmp_orders").update({
      payment_status: "cancelled", delivery_status: "cancelled",
      admin_note: "Cancelled by buyer from GCash ticket.", updated_at: new Date().toISOString()
    }).eq("id", ticket.order_id).eq("payment_status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: ticketError } = await auth.admin.from("gcash_tickets")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (ticketError) return NextResponse.json({ error: ticketError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
