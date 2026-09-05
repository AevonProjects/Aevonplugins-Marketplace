-- AevonSMP Forum Media update
-- Safe to run on an existing forum installation.

alter table public.aevonsmp_forum_threads
  add column if not exists image_url text,
  add column if not exists image_path text,
  add column if not exists video_url text,
  add column if not exists video_path text;

comment on column public.aevonsmp_forum_threads.image_url is 'Public URL of the single optional image attached to this forum thread.';
comment on column public.aevonsmp_forum_threads.video_url is 'Public URL of the single optional video attached to this forum thread (20 MB maximum at upload).';
