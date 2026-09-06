import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  const { data: profile } = await auth.admin.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";

  let q = auth.admin
    .from("gcash_tickets")
    .select("id,order_kind,order_id,order_code,user_id,customer_email,product_name,amount,subject,status,created_at,updated_at")
    .eq("id", id);
  if (!isAdmin) q = q.eq("user_id", auth.user.id);

  const { data: ticket, error } = await q.maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

  const { data: messages, error: msgError } = await auth.admin
    .from("gcash_ticket_messages")
    .select("id,user_id,sender_role,message,created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });
  return NextResponse.json({ ticket, messages: messages || [], viewer: { id: auth.user.id, role: isAdmin ? "admin" : "buyer" } });
}
