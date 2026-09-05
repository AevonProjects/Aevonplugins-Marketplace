import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

const BUCKET = "aevonsmp-forum-media";
const VIDEO_LIMIT = 20 * 1024 * 1024;
const IMAGE_LIMIT = 20 * 1024 * 1024;

async function ensureBucket(admin:any){
  const {data,error}=await admin.storage.getBucket(BUCKET);
  if(data)return;
  const msg=String(error?.message||"").toLowerCase();
  const missing=!error||msg.includes("not found")||msg.includes("does not exist")||msg.includes("related resource");
  if(!missing)throw new Error(error?.message||"Could not check forum media storage.");
  const {error:createError}=await admin.storage.createBucket(BUCKET,{
    public:true,
    fileSizeLimit:VIDEO_LIMIT,
    allowedMimeTypes:["image/*","video/*"]
  });
  if(createError){
    const m=String(createError.message||"").toLowerCase();
    if(!m.includes("already exists")&&!m.includes("duplicate")&&!m.includes("409"))throw createError;
  }
}

function safeExt(name:string,type:string){
  const fromName=(name.split('.').pop()||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toLowerCase();
  if(fromName)return fromName;
  const map:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","image/svg+xml":"svg","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"};
  return map[type]||(type.startsWith('image/')?'img':'video');
}

export async function POST(request:Request){
  const auth=await requireUser(request);
  if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
  const b=await request.json().catch(()=>({}));
  const kind=String(b.kind||'');
  const fileName=String(b.fileName||'upload');
  const contentType=String(b.contentType||'').toLowerCase();
  const size=Number(b.size||0);
  if(kind!=='image'&&kind!=='video')return NextResponse.json({error:'Media type must be image or video.'},{status:400});
  if(kind==='image'&&!contentType.startsWith('image/'))return NextResponse.json({error:'The selected picture is not a valid image file.'},{status:400});
  if(kind==='video'&&!contentType.startsWith('video/'))return NextResponse.json({error:'The selected file is not a valid video.'},{status:400});
  const limit=kind==='video'?VIDEO_LIMIT:IMAGE_LIMIT;
  if(!Number.isFinite(size)||size<=0||size>limit)return NextResponse.json({error:kind==='video'?'Video must be 20 MB or smaller.':'Image must be 20 MB or smaller.'},{status:400});
  try{
    await ensureBucket(auth.admin);
    const ext=safeExt(fileName,contentType);
    const path=`${auth.user.id}/${kind}-${crypto.randomUUID()}.${ext}`;
    const {data,error}=await auth.admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if(error||!data)return NextResponse.json({error:error?.message||'Could not prepare media upload.'},{status:500});
    const publicUrl=auth.admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({path,token:data.token,publicUrl,bucket:BUCKET});
  }catch(e:any){
    console.error('Forum media storage setup failed:',e);
    return NextResponse.json({error:'Forum media storage is not ready. Please try again or check the Supabase service-role configuration.'},{status:500});
  }
}
