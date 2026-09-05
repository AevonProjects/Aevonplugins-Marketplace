import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabaseAdmin';
import { priceWithDiscount } from '@/lib/server/aevonDiscount';

export async function POST(request:Request){
  const auth=await requireUser(request); if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
  const b=await request.json(); const pluginId=String(b.pluginId||'');
  if(!pluginId)return NextResponse.json({error:'Plugin is required.'},{status:400});
  const {data:p}=await auth.admin.from('plugins').select('id,price,status').eq('id',pluginId).eq('status','published').maybeSingle();
  if(!p)return NextResponse.json({error:'Plugin is unavailable.'},{status:404});
  try{ const d=await priceWithDiscount(auth.admin,auth.user,Number(p.price||0),b.discountCode,{kind:'marketplace',productId:p.id}); return NextResponse.json({valid:d.discountPercent>0,...d}); }
  catch(e:any){return NextResponse.json({error:e.message||'Invalid discount code.'},{status:400})}
}
