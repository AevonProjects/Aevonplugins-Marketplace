-- ADiscordALL anonymous marketplace usage analytics.
-- Safe to run more than once. Does not modify or remove ALicense analytics.

create table if not exists public.adiscordall_server_usage (
  license_id uuid not null references public.licenses(id) on delete cascade,
  server_id text not null,
  plugin_version text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_online_count integer not null default 0 check (last_online_count >= 0),
  primary key (license_id, server_id)
);

create table if not exists public.adiscordall_daily_servers (
  usage_date date not null default current_date,
  license_id uuid not null references public.licenses(id) on delete cascade,
  server_id text not null,
  plugin_version text,
  online_count integer not null default 0 check (online_count >= 0),
  last_seen_at timestamptz not null default now(),
  primary key (usage_date, server_id)
);

create table if not exists public.adiscordall_daily_players (
  usage_date date not null default current_date,
  license_id uuid not null references public.licenses(id) on delete cascade,
  server_id text not null,
  player_hash text not null check (player_hash ~ '^[a-f0-9]{64}$'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (usage_date, server_id, player_hash)
);

create index if not exists adiscordall_server_usage_last_seen_idx
  on public.adiscordall_server_usage (last_seen_at desc);
create index if not exists adiscordall_daily_servers_date_idx
  on public.adiscordall_daily_servers (usage_date desc);
create index if not exists adiscordall_daily_players_date_idx
  on public.adiscordall_daily_players (usage_date desc);
create index if not exists adiscordall_daily_players_hash_idx
  on public.adiscordall_daily_players (player_hash);

alter table public.adiscordall_server_usage enable row level security;
alter table public.adiscordall_daily_servers enable row level security;
alter table public.adiscordall_daily_players enable row level security;

revoke all on public.adiscordall_server_usage from anon, authenticated;
revoke all on public.adiscordall_daily_servers from anon, authenticated;
revoke all on public.adiscordall_daily_players from anon, authenticated;

create or replace function public.get_adiscordall_usage_stats(days_back integer default 30)
returns table (
  usage_date date,
  servers bigint,
  players bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with dates as (
    select generate_series(
      current_date - greatest(1, least(coalesce(days_back, 30), 365)) + 1,
      current_date,
      interval '1 day'
    )::date as usage_date
  ),
  s as (
    select usage_date, count(distinct server_id)::bigint as servers
    from public.adiscordall_daily_servers
    where usage_date >= current_date - greatest(1, least(coalesce(days_back, 30), 365)) + 1
    group by usage_date
  ),
  p as (
    select usage_date, count(distinct player_hash)::bigint as players
    from public.adiscordall_daily_players
    where usage_date >= current_date - greatest(1, least(coalesce(days_back, 30), 365)) + 1
    group by usage_date
  )
  select d.usage_date, coalesce(s.servers, 0), coalesce(p.players, 0)
  from dates d
  left join s using (usage_date)
  left join p using (usage_date)
  order by d.usage_date;
$$;

create or replace function public.get_adiscordall_usage_totals()
returns table (
  total_servers bigint,
  active_servers bigint,
  unique_players bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(distinct server_id) from public.adiscordall_server_usage)::bigint,
    (select count(distinct server_id) from public.adiscordall_server_usage where last_seen_at >= now() - interval '7 days')::bigint,
    (select count(distinct player_hash) from public.adiscordall_daily_players)::bigint;
$$;

revoke all on function public.get_adiscordall_usage_stats(integer) from public, anon, authenticated;
revoke all on function public.get_adiscordall_usage_totals() from public, anon, authenticated;
grant execute on function public.get_adiscordall_usage_stats(integer) to service_role;
grant execute on function public.get_adiscordall_usage_totals() to service_role;

NOTIFY pgrst, 'reload schema';
