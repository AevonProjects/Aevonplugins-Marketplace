import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/server/supabaseAdmin';
const allowed=new Set(['like','heart','laugh','wow','sad']);
export async function POST(request:Request,{params}:{params:Promise<{replyId:string}>}){
 const auth=await requireUser(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const {replyId}=await params;const b=await request.json();const reaction=String(b.reaction||'');if(!allowed.has(reaction))return NextResponse.json({error:'Invalid reaction.'},{status:400});
 const {data:r}=await auth.admin.from('aevonsmp_forum_replies').select('id').eq('id',replyId).eq('status','visible').maybeSingle();if(!r)return NextResponse.json({error:'Comment not found.'},{status:404});
 const {data:existing}=await auth.admin.from('aevonsmp_forum_reactions').select('id,reaction').eq('user_id',auth.user.id).eq('reply_id',replyId).maybeSingle();
 if(existing?.reaction===reaction){const {error}=await auth.admin.from('aevonsmp_forum_reactions').delete().eq('id',existing.id);if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({reaction:null});}
 if(existing){const {error}=await auth.admin.from('aevonsmp_forum_reactions').update({reaction,updated_at:new Date().toISOString()}).eq('id',existing.id);if(error)return NextResponse.json({error:error.message},{status:500});}
 else {const {error}=await auth.admin.from('aevonsmp_forum_reactions').insert({user_id:auth.user.id,reply_id:replyId,reaction});if(error)return NextResponse.json({error:error.message},{status:500});}
 return NextResponse.json({reaction});
}
