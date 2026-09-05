import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/supabaseAdmin';

async function findUserByEmail(admin:any,email:string){
  for(let page=1;page<=20;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    if(error)throw error;
    const found=data.users.find((u:any)=>String(u.email||'').toLowerCase()===email.toLowerCase());
    if(found)return found;
    if(data.users.length<1000)break;
  }
  return null;
}
function makeCode(percent:number){return `AEVON${String(percent).replace('.','')}-${randomBytes(4).toString('hex').toUpperCase()}`;}

export async function GET(request:Request){
  const auth=await requireAdmin(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
  const [{data:codes,error},{data:smpCommissions},{data:marketCommissions}]=await Promise.all([
    auth.admin.from('aevonsmp_discount_codes').select('*').order('created_at',{ascending:false}),
    auth.admin.from('aevonsmp_discount_commissions').select('discount_code_id,minecraft_ign,buyer_user_id,commission_amount,status'),
    auth.admin.from('marketplace_discount_commissions').select('discount_code_id,buyer_user_id,commission_amount,status')
  ]);
  if(error)return NextResponse.json({error:error.message},{status:500});
  const result=(codes||[]).map((c:any)=>{const smp=(smpCommissions||[]).filter((x:any)=>x.discount_code_id===c.id&&x.status==='credited');const market=(marketCommissions||[]).filter((x:any)=>x.discount_code_id===c.id&&x.status==='credited');const rows=[...smp,...market];const unique=new Set(rows.map((x:any)=>x.buyer_user_id?`user:${x.buyer_user_id}`:`ign:${String(x.minecraft_ign||'').toLowerCase()}`));return {...c,uses:rows.length,unique_players:unique.size,total_commission:rows.reduce((sum:number,x:any)=>sum+Number(x.commission_amount||0),0)}});
  return NextResponse.json({codes:result});
}

export async function POST(request:Request){
  const auth=await requireAdmin(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
  const b=await request.json();const email=String(b.email||'').trim().toLowerCase();const discount=Math.round(Number(b.discountPercent)*100)/100;const commission=Math.round(Number(b.commissionPercent??5)*100)/100;
  if(!email||!Number.isFinite(discount)||discount<=0||discount>100)return NextResponse.json({error:'Enter a registered email and a discount from 0.01% to 100%.'},{status:400});
  if(!Number.isFinite(commission)||commission<0||commission>100)return NextResponse.json({error:'Commission must be between 0% and 100%.'},{status:400});
  let user:any;try{user=await findUserByEmail(auth.admin,email)}catch(e:any){return NextResponse.json({error:e.message||'Could not look up that account.'},{status:500})}
  if(!user)return NextResponse.json({error:'No registered account was found with that email.'},{status:404});
  const {data:existing}=await auth.admin.from('aevonsmp_discount_codes').select('id,code').eq('owner_user_id',user.id).maybeSingle();
  if(existing)return NextResponse.json({error:`That user already has discount code ${existing.code}. Edit or remove it first.`},{status:409});
  let inserted:any=null,lastError:any=null;
  for(let i=0;i<5&&!inserted;i++){
    const code=makeCode(discount);
    const {data,error}=await auth.admin.from('aevonsmp_discount_codes').insert({code,owner_user_id:user.id,owner_email:email,discount_percent:discount,commission_percent:commission,created_by:auth.user.id,status:'active'}).select('*').single();
    if(!error)inserted=data;else lastError=error;
  }
  if(!inserted)return NextResponse.json({error:lastError?.message||'Could not generate a unique discount code.'},{status:500});
  await auth.admin.from('aevonsmp_commission_wallets').upsert({user_id:user.id,email,balance:0,lifetime_earned:0,updated_at:new Date().toISOString()},{onConflict:'user_id',ignoreDuplicates:true});
  return NextResponse.json({code:inserted});
}
