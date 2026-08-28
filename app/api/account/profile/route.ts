import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabaseAdmin';
export async function PATCH(request:Request){
 const auth=await requireUser(request); if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const body=await request.json().catch(()=>({})); const patch:any={updated_at:new Date().toISOString()};
 if(typeof body.nickname==='string'){
  const nickname=body.nickname.trim(); if(nickname.length<2||nickname.length>32)return NextResponse.json({error:'Nickname must be 2–32 characters.'},{status:400});
  const {data:p}=await auth.admin.from('profiles').select('nickname_changed_at').eq('id',auth.user.id).maybeSingle();
  if(p?.nickname_changed_at && Date.now()-new Date(p.nickname_changed_at).getTime()<30*86400000)return NextResponse.json({error:'Nickname can only be changed once every 30 days.'},{status:429});
  patch.nickname=nickname; patch.nickname_changed_at=new Date().toISOString();
 }
 if(typeof body.avatar_url==='string') patch.avatar_url=body.avatar_url;
 const {data,error}=await auth.admin.from('profiles').update(patch).eq('id',auth.user.id).select('nickname,avatar_url,nickname_changed_at,verification_status').single();
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({profile:data});
}
