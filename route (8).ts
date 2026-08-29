import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/supabaseAdmin';

function safeName(v:string){return v.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-180)}
function safeVersion(v:string){return v.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,60) || 'release'}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireAdmin(request); if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const {id}=await params;
 const body=await request.json();
 const name=safeName(String(body.fileName||'plugin.jar'));
 const version=safeVersion(String(body.version||'release'));
 const path=`${id}/${version}/${Date.now()}-${name}`;
 const {data,error}=await auth.admin.storage.from('plugin-files').createSignedUploadUrl(path);
 if(error||!data)return NextResponse.json({error:error?.message||'Could not prepare upload.'},{status:500});
 return NextResponse.json({path:data.path,token:data.token});
}
