import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabaseAdmin';
export async function GET(request:Request){
 const auth=await requireUser(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const [{data:code},{data:wallet},{data:smpRows},{data:marketRows}]=await Promise.all([
  auth.admin.from('aevonsmp_discount_codes').select('id,code,discount_percent,commission_percent,status,created_at').eq('owner_user_id',auth.user.id).maybeSingle(),
  auth.admin.from('aevonsmp_commission_wallets').select('balance,lifetime_earned,updated_at').eq('user_id',auth.user.id).maybeSingle(),
  auth.admin.from('aevonsmp_discount_commissions').select('id,minecraft_ign,buyer_user_id,order_amount,commission_amount,created_at,status').eq('owner_user_id',auth.user.id).eq('status','credited').order('created_at',{ascending:false}).limit(100),
  auth.admin.from('marketplace_discount_commissions').select('id,buyer_user_id,order_amount,commission_amount,created_at,status').eq('owner_user_id',auth.user.id).eq('status','credited').order('created_at',{ascending:false}).limit(100)
 ]);
 const smp=(smpRows||[]).map((x:any)=>({...x,source:'AevonSMP'}));
 const market=(marketRows||[]).map((x:any)=>({...x,source:'AevonPlugins',minecraft_ign:null}));
 const commissions=[...smp,...market].sort((a:any,b:any)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 const uniqueUsers=new Set<string>();
 for(const x of commissions){ if(x.buyer_user_id) uniqueUsers.add(`user:${x.buyer_user_id}`); else if(x.minecraft_ign) uniqueUsers.add(`ign:${String(x.minecraft_ign).toLowerCase()}`); }
 return NextResponse.json({code:code||null,stats:{uses:commissions.length,uniquePlayers:uniqueUsers.size,totalCommission:commissions.reduce((s:number,x:any)=>s+Number(x.commission_amount||0),0),balance:Number(wallet?.balance||0),lifetimeEarned:Number(wallet?.lifetime_earned||0)},recent:commissions.slice(0,10)});
}
