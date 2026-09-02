"use client";

import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, LockKeyhole, MessageSquareReply, ShieldCheck, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Review = {
  id: string;
  user_id: string;
  rating: number;
  feedback: string;
  created_at: string;
  updated_at: string;
  profiles?: any;
  admin_reply?: {
    id: string;
    review_id: string;
    admin_user_id: string;
    reply: string;
    created_at: string;
    updated_at: string;
    admin_profile?: any;
  } | null;
};

export default function PluginReviews({ pluginId, owned, signedIn }: { pluginId: string; owned: boolean; signedIn: boolean }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<string>('');
  const [replyMsg, setReplyMsg] = useState<Record<string, string>>({});
  const [repliesReady, setRepliesReady] = useState(true);

  const avg = useMemo(
    () => (reviews.length ? reviews.reduce((a, r) => a + Number(r.rating), 0) / reviews.length : 0),
    [reviews],
  );

  async function token() {
    if (!supabase) return '';
    return (await supabase.auth.getSession()).data.session?.access_token || '';
  }

  async function load() {
    const r = await fetch(`/api/reviews/${pluginId}`, { cache: 'no-store' });
    const b = await r.json();
    setReviews(b.reviews || []);
    setRepliesReady(b.repliesReady !== false);
    if (!r.ok && b.error) setMsg(b.error);

    if (supabase) {
      const sessionToken = await token();
      const u = (await supabase.auth.getUser()).data.user;
      const mine = (b.reviews || []).find((x: any) => x.user_id === u?.id);
      if (mine) {
        setRating(mine.rating);
        setFeedback(mine.feedback);
      }

      if (sessionToken) {
        const me = await fetch('/api/account/me', { headers: { Authorization: `Bearer ${sessionToken}` }, cache: 'no-store' });
        if (me.ok) {
          const mb = await me.json();
          setIsAdmin(mb?.profile?.role === 'admin');
        }
      }
    }

    const initialDrafts: Record<string, string> = {};
    for (const review of b.reviews || []) {
      if (review.admin_reply?.reply) initialDrafts[review.id] = review.admin_reply.reply;
    }
    setReplyDrafts((prev) => ({ ...initialDrafts, ...prev }));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginId]);

  async function submit() {
    if (!supabase) return;
    setBusy(true);
    setMsg('');
    const t = await token();
    const r = await fetch(`/api/reviews/${pluginId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ rating, feedback }),
    });
    const b = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(b.error || 'Could not submit review.');
    setMsg('Your review has been saved. You can update it at any time.');
    load();
  }

  async function saveReply(reviewId: string) {
    if (!isAdmin || !supabase) return;
    const reply = String(replyDrafts[reviewId] || '').trim();
    setReplyBusy(reviewId);
    setReplyMsg((x) => ({ ...x, [reviewId]: '' }));
    const t = await token();
    const r = await fetch(`/api/reviews/${pluginId}/${reviewId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ reply }),
    });
    const b = await r.json();
    setReplyBusy('');
    if (!r.ok) {
      setReplyMsg((x) => ({ ...x, [reviewId]: b.error || 'Could not save admin reply.' }));
      return;
    }
    setReplyMsg((x) => ({ ...x, [reviewId]: 'Admin reply saved.' }));
    await load();
  }

  return (
    <section className="pluginReviews">
      <div className="reviewsHeader">
        <div>
          <span>CUSTOMER FEEDBACK</span>
          <h2>Ratings & Reviews</h2>
          <p>Ratings and reviews can only be submitted by customers who have purchased this plugin.</p>
        </div>
        <div className="ratingSummary">
          <strong>{reviews.length ? avg.toFixed(1) : '—'}</strong>
          <div>
            <div className="starsStatic">
              {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={15} fill={n <= Math.round(avg) ? 'currentColor' : 'none'} />)}
            </div>
            <span>{reviews.length} review{reviews.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      <div className="reviewComposer">
        {!signedIn ? (
          <div className="reviewLocked"><LockKeyhole /> Sign in to see whether you can review this plugin.</div>
        ) : !owned ? (
          <div className="reviewLocked"><LockKeyhole /> Only customers who have purchased this plugin can rate or write a review.</div>
        ) : (
          <>
            <div className="starPicker">
              <span>Your rating</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                  <Star fill={n <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
            <textarea value={feedback} maxLength={2000} onChange={(e) => setFeedback(e.target.value)} placeholder="Share your experience with this plugin…" />
            <div className="reviewComposerBottom">
              <span>{feedback.length}/2000</span>
              <button className="primaryBtn" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Submit / Update Review'}</button>
            </div>
            {msg && <p className="fieldHelp">{msg}</p>}
          </>
        )}
      </div>

      <div className="reviewList">
        {reviews.length ? reviews.map((r) => {
          const pr = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          const reply = r.admin_reply;
          const adminProfile = reply?.admin_profile;
          return (
            <article className="reviewCard" key={r.id}>
              <div className="reviewAvatar">
                {pr?.avatar_url ? <img src={pr.avatar_url} alt="" /> : String(pr?.nickname || 'A').slice(0, 1).toUpperCase()}
              </div>
              <div className="reviewBody">
                <div className="reviewAuthor">
                  <strong>{pr?.nickname || 'Aevon User'} {pr?.verification_status === 'verified' && <BadgeCheck className="verifiedBadge" size={15} />}</strong>
                  <span className="ownerBadge">Verified Owner</span>
                  <time>{new Date(r.created_at).toLocaleDateString()}</time>
                </div>
                <div className="starsStatic">
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} fill={n <= r.rating ? 'currentColor' : 'none'} />)}
                </div>
                <p>{r.feedback}</p>

                {reply && (
                  <div className="adminReviewReply">
                    <div className="adminReviewReplyHead">
                      <ShieldCheck size={15} />
                      <strong>{adminProfile?.nickname || 'Aevon Admin'}</strong>
                      <span>Official Admin Reply</span>
                      <time>{new Date(reply.updated_at || reply.created_at).toLocaleDateString()}</time>
                    </div>
                    <p>{reply.reply}</p>
                  </div>
                )}

                {isAdmin && (
                  <div className="adminReplyComposer">
                    <div className="adminReplyLabel"><MessageSquareReply size={14} /> {reply ? 'Edit official reply' : 'Reply as Admin'}</div>
                    <textarea
                      value={replyDrafts[r.id] ?? reply?.reply ?? ''}
                      maxLength={2000}
                      onChange={(e) => setReplyDrafts((x) => ({ ...x, [r.id]: e.target.value }))}
                      placeholder="Write an official admin response to this customer…"
                    />
                    <div className="reviewComposerBottom">
                      <span>{String(replyDrafts[r.id] ?? reply?.reply ?? '').length}/2000</span>
                      <button className="secondaryBtn" disabled={replyBusy === r.id || !repliesReady} onClick={() => saveReply(r.id)}>
                        {replyBusy === r.id ? 'Saving…' : reply ? 'Update Admin Reply' : 'Post Admin Reply'}
                      </button>
                    </div>
                    {!repliesReady && <p className="fieldHelp">Run the review reply SQL migration before posting admin replies.</p>}
                    {replyMsg[r.id] && <p className="fieldHelp">{replyMsg[r.id]}</p>}
                  </div>
                )}
              </div>
            </article>
          );
        }) : (
          <div className="noReviews">No reviews yet. Owners of this plugin can be the first to share feedback.</div>
        )}
      </div>
    </section>
  );
}
