import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireUser(request);if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});const {id}=await params;const b=await request.json();const body=String(b.body||'').trim();const parentReplyId=b.parent_reply_id?String(b.parent_reply_id):null;
 if(!body)return NextResponse.json({error:'Reply cannot be empty.'},{status:400});if(body.length>6000)return NextResponse.json({error:'Reply is too long.'},{status:400});
 const {data:t}=await auth.admin.from('aevonsmp_forum_threads').select('id,status').eq('id',id).maybeSingle();if(!t)return NextResponse.json({error:'Thread not found.'},{status:404});if(t.status!=='open')return NextResponse.json({error:'This thread is locked.'},{status:409});
 if(parentReplyId){const {data:p}=await auth.admin.from('aevonsmp_forum_replies').select('id,thread_id,status').eq('id',parentReplyId).maybeSingle();if(!p||p.thread_id!==id||p.status!=='visible')return NextResponse.json({error:'The comment you are replying to no longer exists.'},{status:404});}
 const {data,error}=await auth.admin.from('aevonsmp_forum_replies').insert({thread_id:id,user_id:auth.user.id,body,parent_reply_id:parentReplyId}).select('*').single();
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({reply:data});
}
