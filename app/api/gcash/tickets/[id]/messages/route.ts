import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  let body: { message?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const message = String(body.message || "").trim();
  if (!message || message.length > 4000) return NextResponse.json({ error: "Message must be between 1 and 4000 characters." }, { status: 400 });

  const { data: profile } = await auth.admin.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";

  const { data: ticket } = await auth.admin
    .from("gcash_tickets")
    .select("id,user_id")
    .eq("id", id)
    .maybeSingle();

  if (!ticket || (!isAdmin && ticket.user_id !== auth.user.id)) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const { data, error } = await auth.admin
    .from("gcash_ticket_messages")
    .insert({ ticket_id: id, user_id: auth.user.id, sender_role: isAdmin ? "admin" : "buyer", message })
    .select("id,user_id,sender_role,message,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.admin.from("gcash_tickets").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ message: data });
}
