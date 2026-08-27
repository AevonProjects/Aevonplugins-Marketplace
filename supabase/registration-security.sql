-- Aevon Marketplace registration security
-- Run once in Supabase SQL Editor before enabling public registration.

create table if not exists public.registration_ip_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  ip_hash text not null unique,
  created_at timestamptz not null default now()
);

alter table public.registration_ip_locks enable row level security;

-- No anon/authenticated policies are intentionally created.
-- Only the server-side Supabase service-role client may access this table.
revoke all on table public.registration_ip_locks from anon, authenticated;
