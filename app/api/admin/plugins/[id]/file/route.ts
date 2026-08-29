import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/supabaseAdmin';

const allowedTypes = new Set(['stable','hotfix','beta','legacy']);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireAdmin(request); if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const {id}=await params;
 const b=await request.json();
 const version=String(b.version||'').trim();
 const releaseType=allowedTypes.has(String(b.releaseType||''))?String(b.releaseType):'stable';
 const changelog=String(b.changelog||'').trim().slice(0,8000) || null;
 if(!b.path||!b.fileName||!version)return NextResponse.json({error:'Missing release metadata.'},{status:400});

 const {data:existing}=await auth.admin.from('plugin_versions').select('id').eq('plugin_id',id).eq('version',version).maybeSingle();
 if(existing)return NextResponse.json({error:`Version ${version} already exists. Use a new version number so the old release remains available.`},{status:409});

 const {data:plugin,error:pluginError}=await auth.admin.from('plugins').select('status').eq('id',id).maybeSingle();
 if(pluginError||!plugin)return NextResponse.json({error:pluginError?.message||'Plugin not found.'},{status:404});

 const {error:clearError}=await auth.admin.from('plugin_versions').update({is_latest:false}).eq('plugin_id',id);
 if(clearError)return NextResponse.json({error:clearError.message},{status:400});

 const {error:insertError}=await auth.admin.from('plugin_versions').insert({
   plugin_id:id,
   version,
   release_type:releaseType,
   changelog,
   file_path:b.path,
   file_name:b.fileName,
   file_size:Number(b.fileSize)||null,
   is_latest:true,
   is_published:plugin.status==='published'
 });
 if(insertError)return NextResponse.json({error:insertError.message},{status:400});

 // Keep the main plugin row synchronized with the release that was just
 // marked latest. Public pages also resolve plugin_versions directly, so the
 // latest uploaded release remains the source of truth on every surface.
 const {error}=await auth.admin.from('plugins').update({
   version,
   file_path:b.path,
   file_name:b.fileName,
   file_size:Number(b.fileSize)||null,
   updated_at:new Date().toISOString()
 }).eq('id',id);
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({ok:true,version});
}
