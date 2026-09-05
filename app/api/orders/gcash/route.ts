import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";
import { priceWithDiscount } from "@/lib/server/aevonDiscount";

function orderCode() {
  return `AEVN-GCASH-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { pluginId?: string; discountCode?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const pluginId = String(body.pluginId || "");
  if (!pluginId) return NextResponse.json({ error: "Plugin is required." }, { status: 400 });

  const { data: plugin } = await auth.admin
    .from("plugins")
    .select("id,name,price,status")
    .eq("id", pluginId)
    .maybeSingle();

  if (!plugin || plugin.status !== "published") return NextResponse.json({ error: "Plugin is unavailable." }, { status: 404 });
  const baseAmount = Number(plugin.price || 0);
  if (baseAmount <= 0) return NextResponse.json({ error: "This plugin does not require payment." }, { status: 400 });
  let pricing;
  try { pricing = await priceWithDiscount(auth.admin, auth.user, baseAmount, body.discountCode); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid discount code." }, { status: 400 }); }

  const { data: owned } = await auth.admin
    .from("user_plugins")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("plugin_id", pluginId)
    .maybeSingle();
  if (owned) return NextResponse.json({ error: "You already own this plugin." }, { status: 409 });

  const { data: pending } = await auth.admin
    .from("marketplace_orders")
    .select("id,order_code,subtotal,amount,status,created_at,discount_code,discount_percent,discount_amount")
    .eq("user_id", auth.user.id)
    .eq("plugin_id", pluginId)
    .eq("payment_method", "gcash")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending && String(pending.discount_code || "") === String(pricing.discountCode || "")) return NextResponse.json({ order: pending, existing: true });

  const email = auth.user.email || "unknown";
  const { data: order, error } = await auth.admin
    .from("marketplace_orders")
    .insert({
      order_code: orderCode(),
      user_id: auth.user.id,
      plugin_id: pluginId,
      customer_email: email,
      payment_method: "gcash",
      subtotal: pricing.subtotal,
      amount: pricing.amount,
      currency: "PHP",
      discount_code_id: pricing.discountCodeId,
      discount_code: pricing.discountCode,
      discount_percent: pricing.discountPercent,
      discount_amount: pricing.discountAmount,
      commission_percent: pricing.commissionPercent,
      commission_amount: pricing.commissionAmount,
      status: "pending"
    })
    .select("id,order_code,subtotal,amount,status,created_at,discount_code,discount_percent,discount_amount")
    .single();

  if (error || !order) return NextResponse.json({ error: error?.message || "Could not create GCash order." }, { status: 500 });
  return NextResponse.json({ order, existing: false });
}
