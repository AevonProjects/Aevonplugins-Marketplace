import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabaseAdmin';
import { paypalRequest } from '@/lib/server/paypal';
export async function POST(request:Request){
 const auth=await requireUser(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});const b=await request.json();const amount=Math.floor(Number(b.amount||0));
 if(amount<100||amount%10!==0)return NextResponse.json({error:'Forum credit top-ups must be at least ₱100 and in ₱10 increments.'},{status:400});const credits=amount/10;
 const orderCode=`FORUM-PAYPAL-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;const origin=new URL(request.url).origin;
 const pr=await paypalRequest('/v2/checkout/orders',{method:'POST',headers:{'PayPal-Request-Id':orderCode},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{custom_id:orderCode,description:`AevonSMP Forum Credits x${credits}`,amount:{currency_code:'PHP',value:amount.toFixed(2)}}],payment_source:{paypal:{experience_context:{brand_name:'AevonSMP Forum',user_action:'PAY_NOW',return_url:`${origin}/aevonsmp/forum/paypal/return`,cancel_url:`${origin}/aevonsmp/forum?credits=cancelled`}}}})});
 const p=await pr.json();if(!pr.ok||!p?.id)return NextResponse.json({error:p?.message||'PayPal could not create the credit order.'},{status:502});const approveUrl=p.links?.find((l:any)=>l.rel==='payer-action'||l.rel==='approve')?.href;if(!approveUrl)return NextResponse.json({error:'PayPal approval link was not returned.'},{status:502});
 const {error}=await auth.admin.from('aevonsmp_forum_credit_orders').insert({order_code:orderCode,user_id:auth.user.id,customer_email:auth.user.email||'unknown',amount,credits,payment_method:'paypal',payment_status:'pending',paypal_order_id:p.id});if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({approveUrl,credits,amount});
}
