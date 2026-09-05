import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/supabaseAdmin';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireAdmin(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});const {id}=await params;const b=await request.json();const row:any={updated_at:new Date().toISOString()};
 if('discountPercent' in b){const v=Math.round(Number(b.discountPercent)*100)/100;if(!Number.isFinite(v)||v<=0||v>100)return NextResponse.json({error:'Discount must be between 0.01% and 100%.'},{status:400});row.discount_percent=v}
 if('commissionPercent' in b){const v=Math.round(Number(b.commissionPercent)*100)/100;if(!Number.isFinite(v)||v<0||v>100)return NextResponse.json({error:'Commission must be between 0% and 100%.'},{status:400});row.commission_percent=v}
 if('status' in b)row.status=b.status==='disabled'?'disabled':'active';
 const {data,error}=await auth.admin.from('aevonsmp_discount_codes').update(row).eq('id',id).select('*').maybeSingle();return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({code:data});
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await requireAdmin(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});const {id}=await params;const {count}=await auth.admin.from('aevonsmp_discount_commissions').select('id',{count:'exact',head:true}).eq('discount_code_id',id);if((count||0)>0)return NextResponse.json({error:'This code already has paid usage history. Disable it instead so commission records are preserved.'},{status:409});const {error}=await auth.admin.from('aevonsmp_discount_codes').delete().eq('id',id);return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({ok:true});}
