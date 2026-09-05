import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabaseAdmin';
import { priceWithDiscount } from '@/lib/server/aevonDiscount';

export async function POST(request:Request){
  const auth=await requireUser(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
  const b=await request.json();const productId=String(b.productId||'');const quantity=Math.floor(Number(b.quantity||1));
  if(!productId||quantity<1)return NextResponse.json({error:'Choose a product and valid quantity.'},{status:400});
  const {data:p}=await auth.admin.from('aevonsmp_products').select('id,price,max_quantity,status').eq('id',productId).eq('status','published').maybeSingle();
  if(!p)return NextResponse.json({error:'Product is unavailable.'},{status:404});
  if(quantity>Number(p.max_quantity||64))return NextResponse.json({error:`Maximum quantity is ${p.max_quantity}.`},{status:400});
  try{
    const d=await priceWithDiscount(auth.admin,auth.user,Number(p.price)*quantity,b.discountCode,{kind:'aevonsmp',productId:p.id});
    return NextResponse.json({valid:d.discountPercent>0,...d});
  }catch(e:any){return NextResponse.json({error:e.message||'Invalid discount code.'},{status:400})}
}
