import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  let body: { message?: string; imagePath?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const message = String(body.message || "").trim();
  const imagePath = String(body.imagePath || "").trim() || null;
  if (!message && !imagePath) return NextResponse.json({ error: "Write a message or attach a picture." }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: "Message cannot exceed 4000 characters." }, { status: 400 });

  const { data: profile } = await auth.admin.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";

  const { data: ticket } = await auth.admin
    .from("gcash_tickets")
    .select("id,user_id,status")
    .eq("id", id)
    .maybeSingle();

  if (!ticket || (!isAdmin && ticket.user_id !== auth.user.id)) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }
  if (ticket.status === "closed") return NextResponse.json({ error: "This ticket is closed." }, { status: 409 });

  if (imagePath) {
    const prefix = `${id}/`;
    if (!imagePath.startsWith(prefix)) return NextResponse.json({ error: "Invalid ticket image." }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("gcash_ticket_messages")
    .insert({
      ticket_id: id,
      user_id: auth.user.id,
      sender_role: isAdmin ? "admin" : "buyer",
      message: message || null,
      image_path: imagePath
    })
    .select("id,user_id,sender_role,message,image_path,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.admin.from("gcash_tickets").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ message: data });
}
