-- Aevon Marketplace Ratings & Reviews + official admin replies
-- Run this entire file once in Supabase Dashboard -> SQL Editor.
-- Safe to run again: all objects use IF NOT EXISTS / policy replacement.

create extension if not exists pgcrypto;

-- One customer review per plugin. The website API checks user_plugins first,
-- so only actual purchasers can create/update their review.
create table if not exists public.plugin_reviews (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  feedback text not null check (char_length(feedback) between 3 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plugin_reviews_one_per_customer unique(plugin_id,user_id)
);

create unique index if not exists plugin_reviews_plugin_user_unique
  on public.plugin_reviews(plugin_id,user_id);
create index if not exists plugin_reviews_plugin_created_idx
  on public.plugin_reviews(plugin_id,created_at desc);

alter table public.plugin_reviews enable row level security;
drop policy if exists "Public read reviews" on public.plugin_reviews;
create policy "Public read reviews"
  on public.plugin_reviews for select
  using (true);

-- Writes to plugin_reviews are intentionally performed only through the
-- server API with the Supabase service role. That API validates ownership.

-- One official admin response per customer review. Posting the reply is also
-- server-only and the API requires profiles.role = 'admin'.
create table if not exists public.plugin_review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.plugin_reviews(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  reply text not null check (char_length(reply) between 2 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plugin_review_replies_one_official_reply unique(review_id)
);

create unique index if not exists plugin_review_replies_review_unique
  on public.plugin_review_replies(review_id);

alter table public.plugin_review_replies enable row level security;
drop policy if exists "Public read admin review replies" on public.plugin_review_replies;
create policy "Public read admin review replies"
  on public.plugin_review_replies for select
  using (true);

-- No direct client INSERT/UPDATE/DELETE policies are created for either table.
-- Customers submit/update through /api/reviews/[pluginId].
-- Admins reply/update through /api/reviews/[pluginId]/[reviewId]/reply.

notify pgrst, 'reload schema';
