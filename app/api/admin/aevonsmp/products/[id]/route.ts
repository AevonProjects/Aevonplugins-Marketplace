import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params; const b = await request.json();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["name","description","image_url"] as const) if (key in b) row[key] = String(b[key] || "").trim() || null;
  if ("reward_command" in b) row.reward_command = String(b.reward_command || "").trim().replace(/^\//, "");
  if ("price" in b) row.price = Math.max(0, Number(b.price || 0));
  if ("required_free_slots" in b) row.required_free_slots = Math.max(0, Math.min(36, Number(b.required_free_slots || 0)));
  if ("max_quantity" in b) row.max_quantity = Math.max(1, Math.min(999, Number(b.max_quantity || 1)));
  if ("sort_order" in b) row.sort_order = Number(b.sort_order || 0);
  if ("command_mode" in b) row.command_mode = b.command_mode === "per_quantity" ? "per_quantity" : "once";
  if ("status" in b) row.status = b.status === "draft" ? "draft" : "published";
  const { data, error } = await auth.admin.from("aevonsmp_products").update(row).eq("id", id).select("*").maybeSingle();
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ product: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params; const { error } = await auth.admin.from("aevonsmp_products").delete().eq("id", id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
