import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";
import { deleteGcashTicketPermanently } from "@/lib/server/gcashTickets";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  const { data: ticket } = await auth.admin.from("gcash_tickets").select("id,status").eq("id", id).maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (ticket.status === "open") return NextResponse.json({ error: "Open payment tickets cannot be permanently deleted. Approve, reject, or wait for the buyer to cancel it first." }, { status: 409 });

  try {
    await deleteGcashTicketPermanently(auth.admin, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not delete ticket." }, { status: 500 });
  }
}
