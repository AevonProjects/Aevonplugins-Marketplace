import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/supabaseAdmin';
import { sanitizePluginHtml } from '@/lib/server/sanitizePluginHtml';

const fields='id,name,slug,description,description_html,version,price,status,created_at,updated_at,file_name,file_path,file_size,gallery_images,profile_image_url,wiki_url,youtube_url,discord_url,paper_versions,purpur_versions';
function clean(body:any){
 const html=sanitizePluginHtml(body.description_html);
 return {name:String(body.name||'').trim().slice(0,120),slug:String(body.slug||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,120),description:String(body.description||'').trim().slice(0,1000),description_html:html,version:String(body.version||'1.0.0').trim().slice(0,40),price:Math.max(0,Number(body.price)||0),status:body.status==='draft'?'draft':'published',wiki_url:safeUrl(body.wiki_url),youtube_url:safeUrl(body.youtube_url),discord_url:safeUrl(body.discord_url),paper_versions:Array.isArray(body.paper_versions)?body.paper_versions.map(String).slice(0,50):[],purpur_versions:Array.isArray(body.purpur_versions)?body.purpur_versions.map(String).slice(0,50):[],updated_at:new Date().toISOString()};
}
function safeUrl(v:any){if(!v)return null;try{const u=new URL(String(v));return ['https:','http:'].includes(u.protocol)?u.toString().slice(0,1000):null}catch{return null}}
export async function GET(request:Request){const a=await requireAdmin(request);if('error'in a)return NextResponse.json({error:a.error},{status:a.status});const {data,error}=await a.admin.from('plugins').select(fields).order('created_at',{ascending:false});return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({plugins:data||[]});}
export async function POST(request:Request){const a=await requireAdmin(request);if('error'in a)return NextResponse.json({error:a.error},{status:a.status});const row=clean(await request.json().catch(()=>({})));if(!row.name||!row.slug)return NextResponse.json({error:'Plugin name and slug are required.'},{status:400});const {data,error}=await a.admin.from('plugins').insert(row).select('id').single();return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({id:data.id});}
