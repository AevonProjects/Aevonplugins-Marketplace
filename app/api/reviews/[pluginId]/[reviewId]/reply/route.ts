import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/supabaseAdmin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pluginId: string; reviewId: string }> },
) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { pluginId, reviewId } = await params;
  const body = await request.json().catch(() => ({}));
  const reply = String(body.reply || '').trim();

  if (reply.length < 2 || reply.length > 2000) {
    return NextResponse.json({ error: 'Admin replies must be 2–2000 characters.' }, { status: 400 });
  }

  const { data: review, error: reviewError } = await auth.admin
    .from('plugin_reviews')
    .select('id,plugin_id')
    .eq('id', reviewId)
    .eq('plugin_id', pluginId)
    .maybeSingle();

  if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: 'Review not found for this plugin.' }, { status: 404 });

  const now = new Date().toISOString();
  const { data, error } = await auth.admin
    .from('plugin_review_replies')
    .upsert(
      {
        review_id: reviewId,
        admin_user_id: auth.user.id,
        reply,
        updated_at: now,
      },
      { onConflict: 'review_id' },
    )
    .select('id,review_id,admin_user_id,reply,created_at,updated_at')
    .single();

  if (error) {
    const migrationMissing = /plugin_review_replies|schema cache|relation .* does not exist/i.test(error.message);
    return NextResponse.json(
      {
        error: migrationMissing
          ? 'Admin review replies are not installed yet. Run supabase/REVIEW-SYSTEM-WITH-ADMIN-REPLIES.sql in Supabase SQL Editor.'
          : error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ reply: data });
}
