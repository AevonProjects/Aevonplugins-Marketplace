-- Aevon Marketplace V2: ownership + secure downloads
alter table public.plugins add column if not exists file_path text;
alter table public.plugins add column if not exists file_name text;
alter table public.plugins add column if not exists file_size bigint;

insert into storage.buckets (id, name, public)
values ('plugin-files', 'plugin-files', false)
on conflict (id) do update set public = false;

-- Intentionally no public storage policies. Upload/download access is issued by
-- authenticated server routes using short-lived signed URLs.
