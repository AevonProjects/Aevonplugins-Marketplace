import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabaseAdmin';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const auth = await requireUser(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id, versionId } = await params;

  const { data: profile } = await auth.admin.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
  const isAdmin = profile?.role === 'admin';

  if (!isAdmin) {
    const { data: access } = await auth.admin.from('user_plugins').select('id').eq('user_id', auth.user.id).eq('plugin_id', id).maybeSingle();
    if (!access) return NextResponse.json({ error: 'You do not own this plugin.' }, { status: 403 });
  }

  const { data: release, error: releaseError } = await auth.admin
    .from('plugin_versions')
    .select('id,plugin_id,version,file_path,file_name,is_published')
    .eq('id', versionId)
    .eq('plugin_id', id)
    .maybeSingle();

  if (releaseError) return NextResponse.json({ error: releaseError.message }, { status: 500 });
  if (!release || (!release.is_published && !isAdmin)) return NextResponse.json({ error: 'This plugin version is not available.' }, { status: 404 });

  if (!isAdmin) {
    const { data: lic } = await auth.admin.from('licenses').select('id,status,download_count').eq('user_id', auth.user.id).eq('plugin_id', id).maybeSingle();
    if (!lic || lic.status !== 'active') return NextResponse.json({ error: 'Your license is not active.' }, { status: 403 });
    await auth.admin.from('licenses').update({ download_count: (lic.download_count || 0) + 1, last_download_at: new Date().toISOString() }).eq('id', lic.id);
  }

  const { data, error } = await auth.admin.storage.from('plugin-files').createSignedUrl(release.file_path, 60, { download: release.file_name || true });
  if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message || 'Could not create download.' }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl, fileName: release.file_name, version: release.version });
}
