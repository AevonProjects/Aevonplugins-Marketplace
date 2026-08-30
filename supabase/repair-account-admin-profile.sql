-- Aevon Marketplace account/profile repair migration
-- Safe to run more than once.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists nickname text,
  add column if not exists nickname_changed_at timestamptz,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verified_at timestamptz;

update public.profiles
set nickname = coalesce(nullif(nickname, ''), nullif(display_name, ''), nullif(username, ''), 'Aevon User')
where nickname is null or nickname = '';

-- Keep the user's existing role unchanged. Admin accounts remain admin.

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set public = true;

-- Browser avatar policies are kept for compatibility, although the updated
-- site now uses a server-created signed upload URL for extra reliability.
drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects
for insert to authenticated
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar" on storage.objects
for update to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow signed-in users to read only their own profile through normal client
-- queries. Admin checks in the updated site are server-side and do not depend
-- on this policy.
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
for select to authenticated
using (id = auth.uid());

-- The existing admin role value is intentionally not modified by this script.
