import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUser } from "@/lib/server/supabaseAdmin";

const REACTIONS=['like','heart','laugh','wow','sad'];
async function decorate(admin:any, rows:any[], viewerId?:string){
  const ids=[...new Set(rows.map(r=>r.user_id).filter(Boolean))];
  const {data:profiles}=ids.length?await admin.from('profiles').select('id,nickname,avatar_url,verification_status,role').in('id',ids):{data:[]};
  const pm=new Map((profiles||[]).map((p:any)=>[p.id,p]));
  const threadIds=rows.map(r=>r.id);
  const {data:replies}=threadIds.length?await admin.from('aevonsmp_forum_replies').select('thread_id').in('thread_id',threadIds).eq('status','visible'):{data:[]};
  const replyCounts=new Map<string,number>(); for(const r of replies||[])replyCounts.set(r.thread_id,(replyCounts.get(r.thread_id)||0)+1);
  const {data:rx}=threadIds.length?await admin.from('aevonsmp_forum_reactions').select('user_id,thread_id,reaction').in('thread_id',threadIds).is('reply_id',null):{data:[]};
  const reactions=new Map<string,any[]>(); for(const r of rx||[]){const a=reactions.get(r.thread_id)||[];a.push(r);reactions.set(r.thread_id,a)}
  return rows.map(r=>{
    const counts:any={like:0,heart:0,laugh:0,wow:0,sad:0}; let viewer_reaction:string|null=null;
    for(const x of reactions.get(r.id)||[]){if(REACTIONS.includes(x.reaction))counts[x.reaction]=(counts[x.reaction]||0)+1;if(viewerId&&x.user_id===viewerId)viewer_reaction=x.reaction;}
    return {...r,author:pm.get(r.user_id)||null,reply_count:replyCounts.get(r.id)||0,reaction_counts:counts,viewer_reaction};
  });
}

export async function GET(request:Request){
  const admin=getSupabaseAdmin();
  const url=new URL(request.url); const limit=Math.min(50,Math.max(1,Number(url.searchParams.get('limit')||30)));
  const {data,error}=await admin.from('aevonsmp_forum_threads').select('*').neq('status','hidden').order('is_pinned',{ascending:false}).order('created_at',{ascending:false}).limit(limit);
  if(error)return NextResponse.json({error:error.message},{status:500});
  let wallet=null; let viewer:any={id:null,role:null}; let viewerId:string|undefined;
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(token){const {data:u}=await admin.auth.getUser(token);if(u.user){viewerId=u.user.id;await admin.from('aevonsmp_forum_wallets').upsert({user_id:u.user.id},{onConflict:'user_id',ignoreDuplicates:true});const {data:w}=await admin.from('aevonsmp_forum_wallets').select('*').eq('user_id',u.user.id).maybeSingle();wallet=w;const {data:p}=await admin.from('profiles').select('role').eq('id',u.user.id).maybeSingle();viewer={id:u.user.id,role:p?.role||null};}}
  return NextResponse.json({threads:await decorate(admin,data||[],viewerId),wallet,viewer});
}

export async function POST(request:Request){
  const auth=await requireUser(request); if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
  const b=await request.json(); const title=String(b.title||'').trim(),body=String(b.body||'').trim();
  const imagePath=String(b.imagePath||'').trim()||null;
  const videoPath=String(b.videoPath||'').trim()||null;
  const ownedPrefix=`${auth.user.id}/`;
  if(imagePath&&!imagePath.startsWith(ownedPrefix))return NextResponse.json({error:'Invalid forum image attachment.'},{status:400});
  if(videoPath&&!videoPath.startsWith(ownedPrefix))return NextResponse.json({error:'Invalid forum video attachment.'},{status:400});
  const {data,error}=await auth.admin.rpc('create_aevonsmp_forum_thread',{p_user_id:auth.user.id,p_title:title,p_body:body});
  if(error){const msg=error.message||'Could not create thread.';if(msg.includes('NO_FORUM_CREDITS'))return NextResponse.json({error:'You have used your free forum post. Buy Forum Credits to create another thread.',needsCredits:true},{status:402});return NextResponse.json({error:msg},{status:400});}
  let thread=data;
  if(imagePath||videoPath){
    const patch:any={};
    if(imagePath){patch.image_path=imagePath;patch.image_url=auth.admin.storage.from('aevonsmp-forum-media').getPublicUrl(imagePath).data.publicUrl;}
    if(videoPath){patch.video_path=videoPath;patch.video_url=auth.admin.storage.from('aevonsmp-forum-media').getPublicUrl(videoPath).data.publicUrl;}
    const {data:updated,error:updateError}=await auth.admin.from('aevonsmp_forum_threads').update(patch).eq('id',data.id).eq('user_id',auth.user.id).select('*').single();
    if(updateError){
      await auth.admin.rpc('delete_aevonsmp_forum_thread',{p_actor_user_id:auth.user.id,p_thread_id:data.id,p_is_admin:false});
      const paths=[imagePath,videoPath].filter(Boolean) as string[];
      if(paths.length)await auth.admin.storage.from('aevonsmp-forum-media').remove(paths);
      return NextResponse.json({error:'Could not attach the uploaded media to the thread. Run supabase/aevonsmp-forum-media-update.sql and try again.'},{status:500});
    }
    thread=updated;
  }
  const {data:w}=await auth.admin.from('aevonsmp_forum_wallets').select('*').eq('user_id',auth.user.id).single();
  return NextResponse.json({thread,wallet:w});
}
