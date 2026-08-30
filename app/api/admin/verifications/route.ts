import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/supabaseAdmin';

export async function GET(r: Request) {
  const a = await requireAdmin(r);
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });

  let result = await a.admin.from('verification_applications')
    .select('id,user_id,legal_name,id_document_path,selfie_path,status,rejection_reason,created_at')
    .order('created_at', { ascending: false }).limit(100);

  if (result.error && result.error.message.toLowerCase().includes('rejection_reason')) {
    result = await a.admin.from('verification_applications')
      .select('id,user_id,legal_name,id_document_path,selfie_path,status,created_at')
      .order('created_at', { ascending: false }).limit(100) as typeof result;
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  const data = result.data || [];
  const ids = [...new Set(data.map((x: any) => x.user_id))];
  const { data: ps } = ids.length ? await a.admin.from('profiles').select('id,nickname').in('id', ids) : { data: [] as any[] };
  const pm = new Map((ps || []).map((x: any) => [x.id, x]));
  const rows = await Promise.all(data.map(async (x: any) => {
    const [id, selfie] = await Promise.all([
      a.admin.storage.from('verification-documents').createSignedUrl(x.id_document_path, 300),
      a.admin.storage.from('verification-documents').createSignedUrl(x.selfie_path, 300)
    ]);
    return { ...x, rejection_reason: x.rejection_reason ?? null, profiles: pm.get(x.user_id) || null, idUrl: id.data?.signedUrl, selfieUrl: selfie.data?.signedUrl };
  }));
  return NextResponse.json({ applications: rows });
}

export async function PATCH(r: Request) {
  const a = await requireAdmin(r);
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const b = await r.json().catch(() => ({}));
  if (!['approved', 'rejected'].includes(b.status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });

  const { data: app } = await a.admin.from('verification_applications').select('id,user_id').eq('id', b.id).maybeSingle();
  if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });

  const fullUpdate = {
    status: b.status,
    rejection_reason: b.status === 'rejected' ? String(b.reason || 'Please submit clearer verification documents.') : null,
    reviewed_by: a.user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  let updateResult = await a.admin.from('verification_applications').update(fullUpdate).eq('id', b.id);
  if (updateResult.error && /rejection_reason|reviewed_by|reviewed_at|updated_at/i.test(updateResult.error.message)) {
    updateResult = await a.admin.from('verification_applications').update({ status: b.status }).eq('id', b.id);
  }
  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });

  const profileUpdate = await a.admin.from('profiles').update({
    verification_status: b.status === 'approved' ? 'verified' : 'rejected',
    verified_at: b.status === 'approved' ? new Date().toISOString() : null
  }).eq('id', app.user_id);
  if (profileUpdate.error) return NextResponse.json({ error: profileUpdate.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
