-- Aevon Marketplace: profiles, private identity verification, and verified-owner reviews
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists nickname text,
  add column if not exists nickname_changed_at timestamptz,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verified_at timestamptz;

update public.profiles set nickname = coalesce(nickname, display_name, username, 'Aevon User') where nickname is null;

create table if not exists public.verification_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legal_name text not null,
  id_document_path text not null,
  selfie_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_pending_verification_per_user on public.verification_applications(user_id) where status='pending';
alter table public.verification_applications enable row level security;

create table if not exists public.plugin_reviews (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  feedback text not null check (char_length(feedback) between 3 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plugin_id,user_id)
);
alter table public.plugin_reviews enable row level security;

drop policy if exists "Public read reviews" on public.plugin_reviews;
create policy "Public read reviews" on public.plugin_reviews for select using (true);

-- Review writes are intentionally server-only. The API verifies ownership in user_plugins.

insert into storage.buckets (id,name,public) values ('profile-avatars','profile-avatars',true)
on conflict(id) do update set public=true;
insert into storage.buckets (id,name,public) values ('verification-documents','verification-documents',false)
on conflict(id) do update set public=false;

-- Users may upload only to their own avatar folder.
drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects for insert to authenticated
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar" on storage.objects for update to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

-- Compatibility repair for databases where verification_applications already existed
-- before the review fields above were introduced.
alter table public.verification_applications
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

notify pgrst, 'reload schema';
