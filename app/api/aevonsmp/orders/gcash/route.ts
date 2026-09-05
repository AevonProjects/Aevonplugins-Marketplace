import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";
import { priceWithDiscount } from "@/lib/server/aevonDiscount";
function validIgn(v:string){return /^(?:[A-Za-z0-9_]{1,16}|\.[A-Za-z0-9_]{1,16})$/.test(v)}
export async function POST(request:Request){
 const auth=await requireUser(request);if("error" in auth)return NextResponse.json({error:auth.error},{status:auth.status}); const b=await request.json();const productId=String(b.productId||"");const ign=String(b.minecraftIgn||"").trim();const quantity=Math.floor(Number(b.quantity||1));
 if(!productId||!validIgn(ign)||quantity<1)return NextResponse.json({error:"Choose a product, valid Minecraft IGN, and quantity."},{status:400});
 const {data:p}=await auth.admin.from("aevonsmp_products").select("*").eq("id",productId).eq("status","published").maybeSingle();if(!p)return NextResponse.json({error:"Product is unavailable."},{status:404});if(quantity>Number(p.max_quantity||64))return NextResponse.json({error:`Maximum quantity is ${p.max_quantity}.`},{status:400});
 let pricing;try{pricing=await priceWithDiscount(auth.admin,auth.user,Number(p.price)*quantity,b.discountCode,{kind:'aevonsmp',productId:p.id})}catch(e:any){return NextResponse.json({error:e.message||"Invalid discount code."},{status:400})}
 const orderCode=`ASMP-GCASH-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
 const {data,error}=await auth.admin.from("aevonsmp_orders").insert({order_code:orderCode,user_id:auth.user.id,customer_email:auth.user.email||"unknown",product_id:p.id,product_name:p.name,unit_price:Number(p.price),quantity,subtotal:pricing.subtotal,amount:pricing.amount,currency:"PHP",minecraft_ign:ign,reward_command:p.reward_command,command_mode:p.command_mode,required_free_slots:p.required_free_slots,payment_method:"gcash",payment_status:"pending",delivery_status:"awaiting_payment",discount_code_id:pricing.discountCodeId,discount_code:pricing.discountCode,discount_percent:pricing.discountPercent,discount_amount:pricing.discountAmount,commission_percent:pricing.commissionPercent,commission_amount:pricing.commissionAmount,verification_discount_applied:pricing.verificationDiscountApplied,verification_discount_percent:pricing.verificationDiscountPercent,verification_discount_amount:pricing.verificationDiscountAmount}).select("id,order_code,subtotal,amount,discount_code,discount_percent,discount_amount,payment_status,delivery_status").single();
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({order:data});
}
