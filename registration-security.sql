-- Aevon Marketplace registration security
-- Run once in Supabase SQL Editor before enabling public registration.

create table if not exists public.registration_security (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  ip_hash text not null,
  vpn_detected boolean not null default false,
  proxy_detected boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists registration_security_ip_hash_unique
on public.registration_security (ip_hash);

alter table public.registration_security enable row level security;

-- No anon/authenticated policies are intentionally created.
-- Only the server-side Supabase service-role client may access this table.
revoke all on table public.registration_security from anon, authenticated;
