import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabaseAdmin';
export async function POST(request:Request){
 const auth=await requireUser(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});const b=await request.json();const amount=Math.floor(Number(b.amount||0));if(amount<100||amount%10!==0)return NextResponse.json({error:'Forum credit top-ups must be at least ₱100 and in ₱10 increments.'},{status:400});const credits=amount/10;const orderCode=`FORUM-GCASH-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
 const {data,error}=await auth.admin.from('aevonsmp_forum_credit_orders').insert({order_code:orderCode,user_id:auth.user.id,customer_email:auth.user.email||'unknown',amount,credits,payment_method:'gcash',payment_status:'pending'}).select('*').single();return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({order:data});
}
