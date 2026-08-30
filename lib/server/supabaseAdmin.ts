import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server Supabase configuration is missing.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Authentication required.', status: 401 } as const;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: 'Invalid or expired session.', status: 401 } as const;
  return { admin, user: data.user } as const;
}

export async function requireAdmin(request: Request) {
  const auth = await requireUser(request);
  if ('error' in auth) return auth;
  const { data } = await auth.admin.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
  if (data?.role !== 'admin') return { error: 'Admin access required.', status: 403 } as const;
  return auth;
}
