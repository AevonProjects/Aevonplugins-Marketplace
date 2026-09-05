import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUser } from "@/lib/server/supabaseAdmin";

const REACTIONS=['like','heart','laugh','wow','sad'];
function summarize(rows:any[],viewerId?:string){
 const counts:any={like:0,heart:0,laugh:0,wow:0,sad:0}; let viewer_reaction:string|null=null;
 for(const r of rows){if(REACTIONS.includes(r.reaction))counts[r.reaction]=(counts[r.reaction]||0)+1;if(viewerId&&r.user_id===viewerId)viewer_reaction=r.reaction;}
 return {reaction_counts:counts,viewer_reaction};
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const admin=getSupabaseAdmin();
 const {data:t,error}=await admin.from('aevonsmp_forum_threads').select('*').eq('id',id).neq('status','hidden').maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500});if(!t)return NextResponse.json({error:'Thread not found.'},{status:404});
 const {data:rs}=await admin.from('aevonsmp_forum_replies').select('*').eq('thread_id',id).eq('status','visible').order('created_at',{ascending:true});
 const ids=[...new Set([t.user_id,...(rs||[]).map((r:any)=>r.user_id)])];
 const {data:ps}=ids.length?await admin.from('profiles').select('id,nickname,avatar_url,verification_status,role').in('id',ids):{data:[]};const pm=new Map((ps||[]).map((p:any)=>[p.id,p]));
 const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');let viewerId:string|undefined;let viewerRole:string|null=null;
 if(token){const {data:u}=await admin.auth.getUser(token);viewerId=u.user?.id;if(viewerId){const {data:p}=await admin.from('profiles').select('role').eq('id',viewerId).maybeSingle();viewerRole=p?.role||null;}}
 const replyIds=(rs||[]).map((r:any)=>r.id);
 const {data:rx}=await admin.from('aevonsmp_forum_reactions').select('user_id,thread_id,reply_id,reaction').or(`thread_id.eq.${id}${replyIds.length?`,reply_id.in.(${replyIds.join(',')})`:''}`);
 const threadRx=(rx||[]).filter((r:any)=>r.thread_id===id);
 const replyRx=new Map<string,any[]>();for(const r of rx||[]){if(r.reply_id){const a=replyRx.get(r.reply_id)||[];a.push(r);replyRx.set(r.reply_id,a)}}
 return NextResponse.json({
   thread:{...t,author:pm.get(t.user_id)||null,...summarize(threadRx,viewerId)},
   replies:(rs||[]).map((r:any)=>({...r,author:pm.get(r.user_id)||null,...summarize(replyRx.get(r.id)||[],viewerId)})),
   viewer:{id:viewerId||null,role:viewerRole}
 });
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireUser(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const {id}=await params;
 const {data:profile}=await auth.admin.from('profiles').select('role').eq('id',auth.user.id).maybeSingle();
 if(profile?.role!=='admin')return NextResponse.json({error:'Only administrators can pin or unpin forum posts.'},{status:403});
 let body:any={};try{body=await request.json()}catch{}
 if(typeof body.is_pinned!=='boolean')return NextResponse.json({error:'is_pinned must be true or false.'},{status:400});
 if(body.is_pinned){
   const {error:clearError}=await auth.admin.from('aevonsmp_forum_threads').update({is_pinned:false}).eq('is_pinned',true);
   if(clearError)return NextResponse.json({error:clearError.message||'Could not clear the previous pinned post.'},{status:400});
 }
 const {data,error}=await auth.admin.from('aevonsmp_forum_threads').update({is_pinned:body.is_pinned,updated_at:new Date().toISOString()}).eq('id',id).neq('status','hidden').select('*').maybeSingle();
 if(error)return NextResponse.json({error:error.message||'Could not update pinned state.'},{status:400});
 if(!data)return NextResponse.json({error:'Post not found.'},{status:404});
 return NextResponse.json({ok:true,thread:data});
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireUser(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const {id}=await params;
 const {data:profile}=await auth.admin.from('profiles').select('role').eq('id',auth.user.id).maybeSingle();
 const isAdmin=profile?.role==='admin';
 const {data:t}=await auth.admin.from('aevonsmp_forum_threads').select('id,user_id,charge_kind,image_path,video_path').eq('id',id).maybeSingle();
 if(!t)return NextResponse.json({error:'Thread not found.'},{status:404});
 if(!isAdmin && t.user_id!==auth.user.id)return NextResponse.json({error:'You can only delete your own forum posts.'},{status:403});
 const {data,error}=await auth.admin.rpc('delete_aevonsmp_forum_thread',{p_actor_user_id:auth.user.id,p_thread_id:id,p_is_admin:isAdmin});
 if(error)return NextResponse.json({error:error.message||'Could not delete thread.'},{status:400});
 const mediaPaths=[t.image_path,t.video_path].filter(Boolean) as string[];
 if(mediaPaths.length){const {error:storageError}=await auth.admin.storage.from('aevonsmp-forum-media').remove(mediaPaths);if(storageError)console.error('Could not remove deleted forum media:',storageError.message);}
 return NextResponse.json({ok:true,wallet:data,restored:t.charge_kind});
}
