import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";
import { paypalRequest } from "@/lib/server/paypal";

function licenseKey() {
  return `AEVN-${randomBytes(5).toString("hex").toUpperCase()}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { paypalOrderId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const paypalOrderId = String(body.paypalOrderId || "");
  if (!paypalOrderId) return NextResponse.json({ error: "PayPal order is required." }, { status: 400 });

  const { data: order } = await auth.admin.from("marketplace_orders")
    .select("id,order_code,user_id,plugin_id,amount,currency,status,paypal_order_id,paypal_capture_id")
    .eq("paypal_order_id", paypalOrderId).eq("payment_method", "paypal").maybeSingle();

  if (!order || order.user_id !== auth.user.id) return NextResponse.json({ error: "PayPal order not found." }, { status: 404 });
  if (order.status === "paid" || order.status === "approved") return NextResponse.json({ ok: true, alreadyPaid: true, pluginId: order.plugin_id });
  if (order.status !== "pending") return NextResponse.json({ error: `This order is ${order.status}.` }, { status: 409 });

  try {
    const captureResponse = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `capture-${order.order_code}` },
      body: "{}"
    });
    const paypal = await captureResponse.json();
    if (!captureResponse.ok) return NextResponse.json({ error: paypal?.message || "PayPal could not capture the payment." }, { status: 502 });
    if (paypal?.status !== "COMPLETED") return NextResponse.json({ error: `PayPal payment status is ${paypal?.status || "unknown"}.` }, { status: 409 });

    const capture = paypal?.purchase_units?.[0]?.payments?.captures?.[0];
    const paidValue = Number(capture?.amount?.value);
    const paidCurrency = String(capture?.amount?.currency_code || "").toUpperCase();
    if (!capture?.id || capture?.status !== "COMPLETED" || paidCurrency !== String(order.currency).toUpperCase() || Math.abs(paidValue - Number(order.amount)) > 0.001) {
      return NextResponse.json({ error: "PayPal payment verification failed. Please contact support with your order reference." }, { status: 409 });
    }

    const { data: existingAccess } = await auth.admin.from("user_plugins").select("id").eq("user_id", order.user_id).eq("plugin_id", order.plugin_id).maybeSingle();
    if (!existingAccess) {
      const { error } = await auth.admin.from("user_plugins").insert({ user_id: order.user_id, plugin_id: order.plugin_id, access_type: "purchase" });
      if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: existingLicense } = await auth.admin.from("licenses").select("id").eq("user_id", order.user_id).eq("plugin_id", order.plugin_id).maybeSingle();
    if (!existingLicense) {
      const { error } = await auth.admin.from("licenses").insert({ user_id: order.user_id, plugin_id: order.plugin_id, license_key: licenseKey(), status: "active" });
      if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await auth.admin.from("marketplace_orders").update({
      status: "paid",
      paypal_capture_id: capture.id,
      paid_at: now,
      reviewed_at: now,
      updated_at: now
    }).eq("id", order.id).eq("status", "pending");
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, pluginId: order.plugin_id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal capture failed." }, { status: 500 });
  }
}
