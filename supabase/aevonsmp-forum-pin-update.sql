-- AevonSMP Forum: admin pinning support
-- Safe to run on an existing forum installation.

alter table if exists public.aevonsmp_forum_threads
  add column if not exists is_pinned boolean not null default false;

create index if not exists aevonsmp_forum_threads_pinned_created_idx
  on public.aevonsmp_forum_threads(is_pinned desc, created_at desc);
