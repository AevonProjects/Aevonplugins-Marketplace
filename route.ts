import { NextResponse } from 'next/server'; import { requireUser } from '@/lib/server/supabaseAdmin';
const okTypes=['image/jpeg','image/png','image/webp','application/pdf'];
export async function POST(request:Request){
 const auth=await requireUser(request); if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const b=await request.json().catch(()=>({})); const legal=String(b.legalName||'').trim(); const id=String(b.idDocumentPath||''); const selfie=String(b.selfiePath||'');
 if(legal.length<3||!id.startsWith(auth.user.id+'/')||!selfie.startsWith(auth.user.id+'/'))return NextResponse.json({error:'Complete all verification fields.'},{status:400});
 const {data:pending}=await auth.admin.from('verification_applications').select('id').eq('user_id',auth.user.id).eq('status','pending').maybeSingle(); if(pending)return NextResponse.json({error:'You already have a verification application under review.'},{status:409});
 const {data,error}=await auth.admin.from('verification_applications').insert({user_id:auth.user.id,legal_name:legal,id_document_path:id,selfie_path:selfie}).select('id,status,created_at').single();
 if(!error)await auth.admin.from('profiles').update({verification_status:'pending'}).eq('id',auth.user.id);
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({application:data});
}
export async function PUT(request:Request){
 const auth=await requireUser(request); if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status}); const b=await request.json().catch(()=>({}));
 const kind=b.kind==='selfie'?'selfie':'id'; const type=String(b.contentType||''); const size=Number(b.size||0); if(!okTypes.includes(type)||size<=0||size>8*1024*1024)return NextResponse.json({error:'Use JPG, PNG, WEBP, or PDF up to 8 MB.'},{status:400});
 const ext=type==='application/pdf'?'pdf':type.split('/')[1].replace('jpeg','jpg'); const path=`${auth.user.id}/${kind}-${Date.now()}.${ext}`;
 const {data,error}=await auth.admin.storage.from('verification-documents').createSignedUploadUrl(path); return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({path,token:data.token});
}
