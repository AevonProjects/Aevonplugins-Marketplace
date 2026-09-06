import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

const ALLOWED = new Set(["image/jpeg","image/png","image/webp","image/gif","image/bmp","image/avif"]);
const MAX = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  const { data: profile } = await auth.admin.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";
  const { data: ticket } = await auth.admin.from("gcash_tickets").select("id,user_id,status").eq("id", id).maybeSingle();

  if (!ticket || (!isAdmin && ticket.user_id !== auth.user.id)) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }
  if (ticket.status === "closed") return NextResponse.json({ error: "This ticket is closed." }, { status: 409 });

  let body: { fileName?: string; contentType?: string; size?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const type = String(body.contentType || "").toLowerCase();
  const size = Number(body.size || 0);
  if (!ALLOWED.has(type)) return NextResponse.json({ error: "Only picture files are allowed." }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > MAX) return NextResponse.json({ error: "Picture must be 5 MB or smaller." }, { status: 400 });

  const extMap: Record<string,string> = {
    "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif",
    "image/bmp":"bmp","image/avif":"avif"
  };
  const path = `${id}/${Date.now()}-${randomBytes(6).toString("hex")}.${extMap[type] || "img"}`;

  const { data, error } = await auth.admin.storage.from("gcash-ticket-images").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || "Could not prepare image upload." }, { status: 500 });

  return NextResponse.json({ path, token: data.token });
}
