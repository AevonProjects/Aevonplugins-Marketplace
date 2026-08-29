alter table public.plugins
  add column if not exists description_html text,
  add column if not exists gallery_images jsonb not null default '[]'::jsonb,
  add column if not exists wiki_url text,
  add column if not exists youtube_url text,
  add column if not exists discord_url text;

insert into storage.buckets (id, name, public)
values ('plugin-media', 'plugin-media', true)
on conflict (id) do update set public = true;
