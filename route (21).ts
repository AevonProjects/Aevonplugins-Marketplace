import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";
import { paypalRequest } from "@/lib/server/paypal";

function orderCode() {
  return `AEVN-PAYPAL-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { pluginId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const pluginId = String(body.pluginId || "");
  if (!pluginId) return NextResponse.json({ error: "Plugin is required." }, { status: 400 });

  const { data: plugin } = await auth.admin.from("plugins").select("id,name,slug,price,status").eq("id", pluginId).maybeSingle();
  if (!plugin || plugin.status !== "published") return NextResponse.json({ error: "Plugin is unavailable." }, { status: 404 });
  const amount = Number(plugin.price || 0);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "This plugin does not require payment." }, { status: 400 });

  const { data: owned } = await auth.admin.from("user_plugins").select("id").eq("user_id", auth.user.id).eq("plugin_id", pluginId).maybeSingle();
  if (owned) return NextResponse.json({ error: "You already own this plugin." }, { status: 409 });

  const origin = new URL(request.url).origin;
  const localOrderCode = orderCode();
  const value = amount.toFixed(2);

  try {
    const paypalResponse = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": localOrderCode },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: plugin.id,
          custom_id: localOrderCode,
          description: `${plugin.name} - Aevon Marketplace`,
          amount: { currency_code: "PHP", value }
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Aevon Marketplace",
              user_action: "PAY_NOW",
              return_url: `${origin}/paypal/return?plugin=${encodeURIComponent(plugin.slug)}`,
              cancel_url: `${origin}/plugins/${encodeURIComponent(plugin.slug)}?paypal=cancelled`
            }
          }
        }
      })
    });
    const paypal = await paypalResponse.json();
    if (!paypalResponse.ok || !paypal?.id) {
      return NextResponse.json({ error: paypal?.message || "PayPal could not create the order." }, { status: 502 });
    }
    const approveUrl = paypal.links?.find((link: { rel?: string; href?: string }) => link.rel === "payer-action" || link.rel === "approve")?.href;
    if (!approveUrl) return NextResponse.json({ error: "PayPal approval link was not returned." }, { status: 502 });

    const { error } = await auth.admin.from("marketplace_orders").insert({
      order_code: localOrderCode,
      user_id: auth.user.id,
      plugin_id: plugin.id,
      customer_email: auth.user.email || "unknown",
      payment_method: "paypal",
      amount,
      currency: "PHP",
      status: "pending",
      paypal_order_id: paypal.id
    });
    if (error) return NextResponse.json({ error: `Could not save PayPal order: ${error.message}` }, { status: 500 });

    return NextResponse.json({ approveUrl, paypalOrderId: paypal.id, orderCode: localOrderCode });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal checkout failed." }, { status: 500 });
  }
}
