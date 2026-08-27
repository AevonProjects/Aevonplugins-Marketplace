import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/supabaseAdmin';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireAdmin(request); if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status}); const {id}=await params; const b=await request.json();
 if(!b.path||!b.fileName)return NextResponse.json({error:'Missing file metadata.'},{status:400});
 const {error}=await auth.admin.from('plugins').update({file_path:b.path,file_name:b.fileName,file_size:Number(b.fileSize)||null,updated_at:new Date().toISOString()}).eq('id',id);
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({ok:true});
}
