import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireAdmin(request); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.admin.from("aevonsmp_products").select("*").order("sort_order").order("created_at");
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ products: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = await request.json();
  const name = String(b.name || "").trim(); const command = String(b.reward_command || "").trim(); const price = Number(b.price); const max = Number(b.max_quantity || 64); const slots = Number(b.required_free_slots || 0);
  if (!name || !command || !Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Product name, valid price, and reward command are required." }, { status: 400 });
  const row = { name, description: String(b.description || "").trim() || null, price, reward_command: command.replace(/^\//, ""), command_mode: b.command_mode === "per_quantity" ? "per_quantity" : "once", required_free_slots: Math.max(0, Math.min(36, slots)), max_quantity: Math.max(1, Math.min(999, max)), image_url: String(b.image_url || "").trim() || null, status: b.status === "draft" ? "draft" : "published", sort_order: Number(b.sort_order || 0), updated_at: new Date().toISOString() };
  const { data, error } = await auth.admin.from("aevonsmp_products").insert(row).select("*").single();
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ product: data });
}
