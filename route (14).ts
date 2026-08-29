import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabaseAdmin';
export async function POST(request: Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireUser(request); if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status}); const {id}=await params;
 const {data:profile}=await auth.admin.from('profiles').select('role').eq('id',auth.user.id).maybeSingle();
 const isAdmin=profile?.role==='admin';
 if(!isAdmin){const {data:access}=await auth.admin.from('user_plugins').select('id').eq('user_id',auth.user.id).eq('plugin_id',id).maybeSingle(); if(!access)return NextResponse.json({error:'You do not own this plugin.'},{status:403});}
 const {data:plugin}=await auth.admin.from('plugins').select('file_path,file_name').eq('id',id).maybeSingle();
 if(!plugin?.file_path)return NextResponse.json({error:'No downloadable file has been uploaded for this plugin yet.'},{status:404});
 if(!isAdmin){const {data:lic}=await auth.admin.from('licenses').select('id,status,download_count').eq('user_id',auth.user.id).eq('plugin_id',id).maybeSingle(); if(!lic||lic.status!=='active')return NextResponse.json({error:'Your license is not active.'},{status:403}); await auth.admin.from('licenses').update({download_count:(lic.download_count||0)+1,last_download_at:new Date().toISOString()}).eq('id',lic.id);}
 const {data,error}=await auth.admin.storage.from('plugin-files').createSignedUrl(plugin.file_path,60,{download:plugin.file_name||true});
 if(error||!data?.signedUrl)return NextResponse.json({error:error?.message||'Could not create download.'},{status:500});
 return NextResponse.json({url:data.signedUrl,fileName:plugin.file_name});
}
