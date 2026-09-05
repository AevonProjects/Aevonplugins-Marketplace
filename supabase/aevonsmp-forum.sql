-- AevonSMP Forum + Forum Credits
-- Run in Supabase SQL Editor after your existing marketplace schema.

create extension if not exists pgcrypto;

create table if not exists public.aevonsmp_forum_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  free_threads_remaining integer not null default 1 check (free_threads_remaining between 0 and 1),
  total_credits_purchased integer not null default 0 check (total_credits_purchased >= 0),
  total_threads_created integer not null default 0 check (total_threads_created >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.aevonsmp_forum_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 1 and 10000),
  status text not null default 'open' check (status in ('open','locked','hidden')),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aevonsmp_forum_threads_created_idx on public.aevonsmp_forum_threads(created_at desc);
create index if not exists aevonsmp_forum_threads_user_idx on public.aevonsmp_forum_threads(user_id);

create table if not exists public.aevonsmp_forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.aevonsmp_forum_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 6000),
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aevonsmp_forum_replies_thread_idx on public.aevonsmp_forum_replies(thread_id,created_at asc);

create table if not exists public.aevonsmp_forum_credit_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_email text not null,
  amount numeric(12,2) not null check (amount >= 100),
  credits integer not null check (credits >= 10),
  currency text not null default 'PHP',
  payment_method text not null check (payment_method in ('paypal','gcash')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','rejected','cancelled')),
  paypal_order_id text unique,
  paypal_capture_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aevonsmp_forum_credit_orders_user_idx on public.aevonsmp_forum_credit_orders(user_id,created_at desc);

create table if not exists public.aevonsmp_forum_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  entry_type text not null check (entry_type in ('purchase','thread_charge','admin_adjustment')),
  order_id uuid references public.aevonsmp_forum_credit_orders(id) on delete set null,
  thread_id uuid references public.aevonsmp_forum_threads(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists aevonsmp_forum_credit_ledger_order_unique on public.aevonsmp_forum_credit_ledger(order_id) where order_id is not null and entry_type='purchase';
create unique index if not exists aevonsmp_forum_credit_ledger_thread_unique on public.aevonsmp_forum_credit_ledger(thread_id) where thread_id is not null and entry_type='thread_charge';

create or replace function public.create_aevonsmp_forum_thread(p_user_id uuid, p_title text, p_body text)
returns public.aevonsmp_forum_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.aevonsmp_forum_wallets;
  t public.aevonsmp_forum_threads;
begin
  if p_user_id is null then raise exception 'Authentication required.'; end if;
  if char_length(trim(coalesce(p_title,''))) < 3 then raise exception 'Title must be at least 3 characters.'; end if;
  if char_length(trim(coalesce(p_body,''))) < 1 then raise exception 'Post cannot be empty.'; end if;
  if char_length(trim(p_title)) > 120 then raise exception 'Title is too long.'; end if;
  if char_length(p_body) > 10000 then raise exception 'Post is too long.'; end if;

  insert into public.aevonsmp_forum_wallets(user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into w from public.aevonsmp_forum_wallets where user_id=p_user_id for update;

  if w.free_threads_remaining <= 0 and w.credits <= 0 then
    raise exception 'NO_FORUM_CREDITS';
  end if;

  insert into public.aevonsmp_forum_threads(user_id,title,body)
  values (p_user_id,trim(p_title),trim(p_body)) returning * into t;

  if w.free_threads_remaining > 0 then
    update public.aevonsmp_forum_wallets
      set free_threads_remaining=free_threads_remaining-1,total_threads_created=total_threads_created+1,updated_at=now()
      where user_id=p_user_id;
  else
    update public.aevonsmp_forum_wallets
      set credits=credits-1,total_threads_created=total_threads_created+1,updated_at=now()
      where user_id=p_user_id;
    insert into public.aevonsmp_forum_credit_ledger(user_id,amount,entry_type,thread_id,note)
      values(p_user_id,-1,'thread_charge',t.id,'Forum thread creation');
  end if;
  return t;
end;
$$;

create or replace function public.credit_aevonsmp_forum_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.aevonsmp_forum_credit_orders;
  current_balance integer;
begin
  select * into o from public.aevonsmp_forum_credit_orders where id=p_order_id for update;
  if o.id is null then raise exception 'Credit order not found.'; end if;
  if o.payment_status <> 'paid' then raise exception 'Credit order is not paid.'; end if;

  insert into public.aevonsmp_forum_wallets(user_id) values(o.user_id)
  on conflict (user_id) do nothing;

  insert into public.aevonsmp_forum_credit_ledger(user_id,amount,entry_type,order_id,note)
  values(o.user_id,o.credits,'purchase',o.id,concat('Forum credits purchased via ',upper(o.payment_method)))
  on conflict do nothing;

  if found then
    update public.aevonsmp_forum_wallets
      set credits=credits+o.credits,total_credits_purchased=total_credits_purchased+o.credits,updated_at=now()
      where user_id=o.user_id;
  end if;
  select credits into current_balance from public.aevonsmp_forum_wallets where user_id=o.user_id;
  return current_balance;
end;
$$;

alter table public.aevonsmp_forum_wallets enable row level security;
alter table public.aevonsmp_forum_threads enable row level security;
alter table public.aevonsmp_forum_replies enable row level security;
alter table public.aevonsmp_forum_credit_orders enable row level security;
alter table public.aevonsmp_forum_credit_ledger enable row level security;

-- Public forum can be read by signed-in and anonymous visitors; writes go through server API routes.
drop policy if exists forum_threads_public_read on public.aevonsmp_forum_threads;
create policy forum_threads_public_read on public.aevonsmp_forum_threads for select using (status <> 'hidden');
drop policy if exists forum_replies_public_read on public.aevonsmp_forum_replies;
create policy forum_replies_public_read on public.aevonsmp_forum_replies for select using (status='visible');

grant execute on function public.create_aevonsmp_forum_thread(uuid,text,text) to service_role;
grant execute on function public.credit_aevonsmp_forum_order(uuid) to service_role;

-- ============================================================
-- Forum social update: nested replies, reactions, safe deletion
-- Re-running this section is safe.
-- ============================================================

alter table public.aevonsmp_forum_threads
  add column if not exists charge_kind text;

-- Best-effort migration for threads created before charge_kind existed:
-- first thread for an account = free entitlement, later threads = credit.
with ranked as (
  select id, row_number() over(partition by user_id order by created_at,id) as rn
  from public.aevonsmp_forum_threads
  where charge_kind is null
)
update public.aevonsmp_forum_threads t
set charge_kind = case when r.rn=1 then 'free' else 'credit' end
from ranked r where r.id=t.id;

alter table public.aevonsmp_forum_threads
  alter column charge_kind set default 'free';
alter table public.aevonsmp_forum_threads
  alter column charge_kind set not null;
alter table public.aevonsmp_forum_threads
  drop constraint if exists aevonsmp_forum_threads_charge_kind_check;
alter table public.aevonsmp_forum_threads
  add constraint aevonsmp_forum_threads_charge_kind_check check (charge_kind in ('free','credit'));

alter table public.aevonsmp_forum_replies
  add column if not exists parent_reply_id uuid references public.aevonsmp_forum_replies(id) on delete cascade;
create index if not exists aevonsmp_forum_replies_parent_idx on public.aevonsmp_forum_replies(parent_reply_id);

create table if not exists public.aevonsmp_forum_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.aevonsmp_forum_threads(id) on delete cascade,
  reply_id uuid references public.aevonsmp_forum_replies(id) on delete cascade,
  reaction text not null check (reaction in ('like','heart','laugh','wow','sad')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aevonsmp_forum_reactions_one_target check (
    (thread_id is not null and reply_id is null) or
    (thread_id is null and reply_id is not null)
  )
);
create unique index if not exists aevonsmp_forum_reactions_thread_user_unique
  on public.aevonsmp_forum_reactions(user_id,thread_id) where thread_id is not null;
create unique index if not exists aevonsmp_forum_reactions_reply_user_unique
  on public.aevonsmp_forum_reactions(user_id,reply_id) where reply_id is not null;
create index if not exists aevonsmp_forum_reactions_thread_idx on public.aevonsmp_forum_reactions(thread_id);
create index if not exists aevonsmp_forum_reactions_reply_idx on public.aevonsmp_forum_reactions(reply_id);

alter table public.aevonsmp_forum_reactions enable row level security;
drop policy if exists forum_reactions_public_read on public.aevonsmp_forum_reactions;
create policy forum_reactions_public_read on public.aevonsmp_forum_reactions for select using (true);

-- Replace creation RPC so the exact entitlement used is recorded on the thread.
create or replace function public.create_aevonsmp_forum_thread(p_user_id uuid, p_title text, p_body text)
returns public.aevonsmp_forum_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.aevonsmp_forum_wallets;
  t public.aevonsmp_forum_threads;
  entitlement text;
begin
  if p_user_id is null then raise exception 'Authentication required.'; end if;
  if char_length(trim(coalesce(p_title,''))) < 3 then raise exception 'Title must be at least 3 characters.'; end if;
  if char_length(trim(coalesce(p_body,''))) < 1 then raise exception 'Post cannot be empty.'; end if;
  if char_length(trim(p_title)) > 120 then raise exception 'Title is too long.'; end if;
  if char_length(p_body) > 10000 then raise exception 'Post is too long.'; end if;

  insert into public.aevonsmp_forum_wallets(user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into w from public.aevonsmp_forum_wallets where user_id=p_user_id for update;

  if w.free_threads_remaining <= 0 and w.credits <= 0 then
    raise exception 'NO_FORUM_CREDITS';
  end if;

  entitlement := case when w.free_threads_remaining > 0 then 'free' else 'credit' end;
  insert into public.aevonsmp_forum_threads(user_id,title,body,charge_kind)
  values (p_user_id,trim(p_title),trim(p_body),entitlement) returning * into t;

  if entitlement='free' then
    update public.aevonsmp_forum_wallets
      set free_threads_remaining=0,total_threads_created=total_threads_created+1,updated_at=now()
      where user_id=p_user_id;
  else
    update public.aevonsmp_forum_wallets
      set credits=credits-1,total_threads_created=total_threads_created+1,updated_at=now()
      where user_id=p_user_id;
    insert into public.aevonsmp_forum_credit_ledger(user_id,amount,entry_type,thread_id,note)
      values(p_user_id,-1,'thread_charge',t.id,'Forum thread creation');
  end if;
  return t;
end;
$$;

-- Deletes a thread and restores the exact posting entitlement it consumed.
create or replace function public.delete_aevonsmp_forum_thread(p_actor_user_id uuid, p_thread_id uuid, p_is_admin boolean default false)
returns public.aevonsmp_forum_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.aevonsmp_forum_threads;
  w public.aevonsmp_forum_wallets;
begin
  select * into t from public.aevonsmp_forum_threads where id=p_thread_id for update;
  if t.id is null then raise exception 'Thread not found.'; end if;
  if not p_is_admin and t.user_id <> p_actor_user_id then raise exception 'You can only delete your own forum posts.'; end if;

  insert into public.aevonsmp_forum_wallets(user_id) values(t.user_id)
  on conflict (user_id) do nothing;
  select * into w from public.aevonsmp_forum_wallets where user_id=t.user_id for update;

  if t.charge_kind='free' then
    update public.aevonsmp_forum_wallets
      set free_threads_remaining=1,updated_at=now()
      where user_id=t.user_id;
  else
    update public.aevonsmp_forum_wallets
      set credits=credits+1,updated_at=now()
      where user_id=t.user_id;
  end if;

  delete from public.aevonsmp_forum_threads where id=t.id;
  select * into w from public.aevonsmp_forum_wallets where user_id=t.user_id;
  return w;
end;
$$;

grant execute on function public.delete_aevonsmp_forum_thread(uuid,uuid,boolean) to service_role;

-- ============================================================
-- Forum media update: one image + one video per thread
-- ============================================================
alter table public.aevonsmp_forum_threads
  add column if not exists image_url text,
  add column if not exists image_path text,
  add column if not exists video_url text,
  add column if not exists video_path text;
