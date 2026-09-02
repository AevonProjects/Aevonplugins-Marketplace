import { NextResponse } from 'next/server';
import { requireUser, getSupabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function GET(_r: Request, { params }: { params: Promise<{ pluginId: string }> }) {
  const { pluginId } = await params;
  const a = getSupabaseAdmin();

  const { data, error } = await a
    .from('plugin_reviews')
    .select('id,user_id,rating,feedback,created_at,updated_at')
    .eq('plugin_id', pluginId)
    .order('created_at', { ascending: false });

  if (error) {
    const migrationMissing = /plugin_reviews|schema cache|relation .* does not exist/i.test(error.message);
    return NextResponse.json(
      {
        reviews: [],
        error: migrationMissing
          ? 'The Ratings & Reviews database migration has not been installed yet. Run supabase/REVIEW-SYSTEM-WITH-ADMIN-REPLIES.sql in Supabase SQL Editor.'
          : error.message,
      },
      { status: 500 },
    );
  }

  const reviewIds = (data || []).map((x: any) => x.id);
  const userIds = [...new Set((data || []).map((x: any) => x.user_id))];

  const { data: profiles } = userIds.length
    ? await a.from('profiles').select('id,nickname,avatar_url,verification_status').in('id', userIds)
    : { data: [] as any[] };

  const { data: replies, error: replyError } = reviewIds.length
    ? await a
        .from('plugin_review_replies')
        .select('id,review_id,admin_user_id,reply,created_at,updated_at')
        .in('review_id', reviewIds)
    : { data: [] as any[], error: null as any };

  // Older databases may have reviews installed but not the reply migration yet.
  // Reviews still render; the admin reply UI will show a migration hint if used.
  const replyRows = replyError ? [] : replies || [];
  const adminIds = [...new Set(replyRows.map((x: any) => x.admin_user_id).filter(Boolean))];
  const { data: adminProfiles } = adminIds.length
    ? await a.from('profiles').select('id,nickname,avatar_url,verification_status,role').in('id', adminIds)
    : { data: [] as any[] };

  const profileMap = new Map((profiles || []).map((x: any) => [x.id, x]));
  const adminMap = new Map((adminProfiles || []).map((x: any) => [x.id, x]));
  const replyMap = new Map(
    replyRows.map((x: any) => [
      x.review_id,
      { ...x, admin_profile: adminMap.get(x.admin_user_id) || null },
    ]),
  );

  return NextResponse.json({
    reviews: (data || []).map((x: any) => ({
      ...x,
      profiles: profileMap.get(x.user_id) || null,
      admin_reply: replyMap.get(x.id) || null,
    })),
    repliesReady: !replyError,
  });
}

export async function POST(r: Request, { params }: { params: Promise<{ pluginId: string }> }) {
  const auth = await requireUser(r);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { pluginId } = await params;
  const { data: own } = await auth.admin
    .from('user_plugins')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('plugin_id', pluginId)
    .maybeSingle();

  if (!own) {
    return NextResponse.json(
      { error: 'Only customers who have purchased this plugin can submit a review.' },
      { status: 403 },
    );
  }

  const b = await r.json().catch(() => ({}));
  const rating = Number(b.rating);
  const feedback = String(b.feedback || '').trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || feedback.length < 3 || feedback.length > 2000) {
    return NextResponse.json({ error: 'Choose 1–5 stars and write 3–2000 characters.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await auth.admin
    .from('plugin_reviews')
    .upsert(
      { plugin_id: pluginId, user_id: auth.user.id, rating, feedback, updated_at: now },
      { onConflict: 'plugin_id,user_id' },
    )
    .select()
    .single();

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ review: data });
}
