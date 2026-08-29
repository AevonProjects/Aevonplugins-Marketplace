-- Aevon Marketplace plugin release/version history.
-- Safe to run more than once.

create table if not exists public.plugin_versions (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  version text not null,
  release_type text not null default 'stable'
    check (release_type in ('stable','hotfix','beta','legacy')),
  changelog text,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  is_latest boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (plugin_id, version)
);

create index if not exists plugin_versions_plugin_id_created_at_idx
  on public.plugin_versions (plugin_id, created_at desc);

create unique index if not exists plugin_versions_one_latest_per_plugin
  on public.plugin_versions (plugin_id)
  where is_latest = true;

alter table public.plugin_versions enable row level security;

-- Public visitors may see release metadata for published releases.
drop policy if exists "Public can view published plugin versions" on public.plugin_versions;
create policy "Public can view published plugin versions"
on public.plugin_versions
for select
to anon, authenticated
using (is_published = true);

-- Admins can manage all release metadata from the dashboard.
drop policy if exists "Admins can manage plugin versions" on public.plugin_versions;
create policy "Admins can manage plugin versions"
on public.plugin_versions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Backfill the currently uploaded JAR as the first version-history entry.
insert into public.plugin_versions (
  plugin_id, version, release_type, changelog,
  file_path, file_name, file_size, is_latest, is_published, created_at
)
select
  p.id,
  coalesce(nullif(trim(p.version), ''), '1.0.0'),
  'stable',
  'Existing marketplace release imported into version history.',
  p.file_path,
  p.file_name,
  p.file_size,
  true,
  p.status = 'published',
  coalesce(p.updated_at, p.created_at, now())
from public.plugins p
where p.file_path is not null
  and p.file_name is not null
  and not exists (
    select 1 from public.plugin_versions pv where pv.plugin_id = p.id
  );

NOTIFY pgrst, 'reload schema';
