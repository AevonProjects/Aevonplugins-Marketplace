import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";

function licenseKey() {
  return `AEVN-${randomBytes(5).toString("hex").toUpperCase()}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  const { data: order } = await auth.admin
    .from("marketplace_orders")
    .select("id,user_id,plugin_id,status,payment_method")
    .eq("id", id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status === "approved" || order.status === "paid") return NextResponse.json({ ok: true, alreadyApproved: true });
  if (order.status !== "pending") return NextResponse.json({ error: `Order is ${order.status} and cannot be approved.` }, { status: 409 });

  const { data: existingAccess } = await auth.admin.from("user_plugins")
    .select("id").eq("user_id", order.user_id).eq("plugin_id", order.plugin_id).maybeSingle();
  if (!existingAccess) {
    const { error } = await auth.admin.from("user_plugins").insert({
      user_id: order.user_id,
      plugin_id: order.plugin_id,
      access_type: "purchase"
    });
    if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: existingLicense } = await auth.admin.from("licenses")
    .select("id").eq("user_id", order.user_id).eq("plugin_id", order.plugin_id).maybeSingle();
  if (!existingLicense) {
    const { error } = await auth.admin.from("licenses").insert({
      user_id: order.user_id,
      plugin_id: order.plugin_id,
      license_key: licenseKey(),
      status: "active"
    });
    if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await auth.admin.from("marketplace_orders").update({
    status: "approved",
    reviewed_at: now,
    reviewed_by: auth.user.id,
    updated_at: now
  }).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
