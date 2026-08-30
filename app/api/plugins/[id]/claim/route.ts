import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabaseAdmin';

function licenseKey(){return `AEVN-${randomBytes(5).toString('hex').toUpperCase()}-${randomBytes(5).toString('hex').toUpperCase()}`;}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request); if ('error' in auth) return NextResponse.json({error:auth.error},{status:auth.status});
  const { id } = await params;
  const { data: plugin } = await auth.admin.from('plugins').select('id,price,status').eq('id',id).maybeSingle();
  if (!plugin || plugin.status !== 'published') return NextResponse.json({error:'Plugin is unavailable.'},{status:404});
  if (Number(plugin.price) !== 0) return NextResponse.json({error:'Only free plugins can be claimed directly.'},{status:400});
  const { data: existing } = await auth.admin.from('user_plugins').select('id').eq('user_id',auth.user.id).eq('plugin_id',id).maybeSingle();
  if (!existing) {
    const { error } = await auth.admin.from('user_plugins').insert({user_id:auth.user.id,plugin_id:id,access_type:'grant'});
    if (error && error.code !== '23505') return NextResponse.json({error:error.message},{status:400});
  }
  const { data: existingLicense } = await auth.admin.from('licenses').select('id').eq('user_id',auth.user.id).eq('plugin_id',id).maybeSingle();
  if (!existingLicense) {
    const { error } = await auth.admin.from('licenses').insert({user_id:auth.user.id,plugin_id:id,license_key:licenseKey(),status:'active'});
    if (error && error.code !== '23505') return NextResponse.json({error:error.message},{status:400});
  }
  return NextResponse.json({ok:true});
}
