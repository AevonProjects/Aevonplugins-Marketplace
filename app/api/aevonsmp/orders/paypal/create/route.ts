import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";
import { paypalRequest } from "@/lib/server/paypal";
import { priceWithDiscount } from "@/lib/server/aevonDiscount";
function code(){ return `ASMP-PAYPAL-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`; }
function validIgn(v:string){ return /^(?:[A-Za-z0-9_]{1,16}|\.[A-Za-z0-9_]{1,16})$/.test(v); }
export async function POST(request: Request) {
  const auth = await requireUser(request); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = await request.json(); const productId = String(b.productId || ""); const ign = String(b.minecraftIgn || "").trim(); const quantity = Math.floor(Number(b.quantity || 1));
  if (!productId || !validIgn(ign) || quantity < 1) return NextResponse.json({ error: "Choose a product, valid Minecraft IGN, and quantity." }, { status: 400 });
  const { data:p } = await auth.admin.from("aevonsmp_products").select("*").eq("id", productId).eq("status", "published").maybeSingle();
  if (!p) return NextResponse.json({ error: "Product is unavailable." }, { status: 404 });
  if (quantity > Number(p.max_quantity || 64)) return NextResponse.json({ error: `Maximum quantity is ${p.max_quantity}.` }, { status: 400 });
  let pricing;try{pricing=await priceWithDiscount(auth.admin,auth.user,Number(p.price)*quantity,b.discountCode)}catch(e:any){return NextResponse.json({error:e.message||"Invalid discount code."},{status:400})}
  if (pricing.amount <= 0) return NextResponse.json({ error: "This discount results in a free order, which is not available through PayPal checkout." }, { status: 400 });
  const orderCode = code(); const origin = new URL(request.url).origin;
  const pr = await paypalRequest("/v2/checkout/orders", { method:"POST", headers:{"PayPal-Request-Id":orderCode}, body:JSON.stringify({ intent:"CAPTURE", purchase_units:[{reference_id:p.id,custom_id:orderCode,description:`${p.name} x${quantity} - AevonSMP`,amount:{currency_code:"PHP",value:pricing.amount.toFixed(2)}}], payment_source:{paypal:{experience_context:{brand_name:"AevonSMP Store",user_action:"PAY_NOW",return_url:`${origin}/aevonsmp/paypal/return`,cancel_url:`${origin}/aevonsmp?payment=cancelled`}}} }) });
  const paypal = await pr.json(); if (!pr.ok || !paypal?.id) return NextResponse.json({ error: paypal?.message || "PayPal could not create the order." }, { status: 502 });
  const approveUrl = paypal.links?.find((l:{rel?:string;href?:string})=>l.rel==="payer-action"||l.rel==="approve")?.href; if (!approveUrl) return NextResponse.json({ error:"PayPal approval link was not returned." }, { status:502 });
  const { error } = await auth.admin.from("aevonsmp_orders").insert({ order_code:orderCode,user_id:auth.user.id,customer_email:auth.user.email||"unknown",product_id:p.id,product_name:p.name,unit_price:Number(p.price),quantity,subtotal:pricing.subtotal,amount:pricing.amount,currency:"PHP",minecraft_ign:ign,reward_command:p.reward_command,command_mode:p.command_mode,required_free_slots:p.required_free_slots,payment_method:"paypal",payment_status:"pending",delivery_status:"awaiting_payment",paypal_order_id:paypal.id,discount_code_id:pricing.discountCodeId,discount_code:pricing.discountCode,discount_percent:pricing.discountPercent,discount_amount:pricing.discountAmount,commission_percent:pricing.commissionPercent,commission_amount:pricing.commissionAmount });
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  return NextResponse.json({ approveUrl, paypalOrderId:paypal.id, orderCode, subtotal:pricing.subtotal, amount:pricing.amount, discountAmount:pricing.discountAmount });
}
