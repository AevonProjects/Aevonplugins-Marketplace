import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/server/supabaseAdmin';
const allowed=new Set(['like','heart','laugh','wow','sad']);
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireUser(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const {id}=await params;const b=await request.json();const reaction=String(b.reaction||'');if(!allowed.has(reaction))return NextResponse.json({error:'Invalid reaction.'},{status:400});
 const {data:t}=await auth.admin.from('aevonsmp_forum_threads').select('id').eq('id',id).neq('status','hidden').maybeSingle();if(!t)return NextResponse.json({error:'Thread not found.'},{status:404});
 const {data:existing}=await auth.admin.from('aevonsmp_forum_reactions').select('id,reaction').eq('user_id',auth.user.id).eq('thread_id',id).maybeSingle();
 if(existing?.reaction===reaction){const {error}=await auth.admin.from('aevonsmp_forum_reactions').delete().eq('id',existing.id);if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({reaction:null});}
 if(existing){const {error}=await auth.admin.from('aevonsmp_forum_reactions').update({reaction,updated_at:new Date().toISOString()}).eq('id',existing.id);if(error)return NextResponse.json({error:error.message},{status:500});}
 else {const {error}=await auth.admin.from('aevonsmp_forum_reactions').insert({user_id:auth.user.id,thread_id:id,reaction});if(error)return NextResponse.json({error:error.message},{status:500});}
 return NextResponse.json({reaction});
}
