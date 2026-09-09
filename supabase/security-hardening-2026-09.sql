-- Aevon Marketplace security hardening (2026-09)
-- Run in Supabase SQL Editor after deploying the matching website update.

-- Marketplace plugin listings are browser-readable only when published.
-- All plugin writes now go through server-side /api/admin/plugins routes.
alter table public.plugins enable row level security;
revoke insert, update, delete on table public.plugins from anon, authenticated;
grant select on table public.plugins to anon, authenticated;
drop policy if exists "Public can read published plugins" on public.plugins;
create policy "Public can read published plugins" on public.plugins
for select to anon, authenticated using (status = 'published');

-- Plugin versions are also never writable directly by browser roles.
alter table public.plugin_versions enable row level security;
revoke insert, update, delete on table public.plugin_versions from anon, authenticated;

-- Prevent clients from writing privilege-bearing profile fields through Data API.
-- Profile edits in this app already go through server routes with an explicit allowlist.
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

-- Keep sensitive verification material private. Public access must never be enabled.
update storage.buckets set public=false where id in ('account-verification','gcash-ticket-media','plugin-files');

-- New public-schema objects should not automatically become browser-writable.
alter default privileges for role postgres in schema public revoke insert, update, delete on tables from anon, authenticated;
