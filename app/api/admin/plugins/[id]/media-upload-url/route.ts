import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/supabaseAdmin';
function safeName(v:string){return v.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-180)}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireAdmin(request); if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const {id}=await params; const body=await request.json(); const size=Number(body.fileSize||0); const type=String(body.fileType||'');
 if(size<=0||size>5*1024*1024)return NextResponse.json({error:'Each image must be 5 MB or smaller.'},{status:400});
 if(!['image/png','image/jpeg','image/webp','image/gif'].includes(type))return NextResponse.json({error:'Use PNG, JPG, WEBP, or GIF images.'},{status:400});
 const name=safeName(String(body.fileName||'image.png')); const path=`${id}/${Date.now()}-${name}`;
 const {data,error}=await auth.admin.storage.from('plugin-media').createSignedUploadUrl(path); if(error||!data)return NextResponse.json({error:error?.message||'Could not prepare image upload.'},{status:500});
 return NextResponse.json({path:data.path,token:data.token});
}
