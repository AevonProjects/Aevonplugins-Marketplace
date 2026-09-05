-- AevonSMP Forum Social Update
-- Adds nested comment replies, reactions, owner/admin deletion, and entitlement restoration.
-- Safe to run after the original aevonsmp-forum.sql.

create extension if not exists pgcrypto;

alter table public.aevonsmp_forum_threads add column if not exists charge_kind text;
with ranked as (
  select id, row_number() over(partition by user_id order by created_at,id) as rn
  from public.aevonsmp_forum_threads where charge_kind is null
)
update public.aevonsmp_forum_threads t
set charge_kind=case when r.rn=1 then 'free' else 'credit' end
from ranked r where r.id=t.id;
alter table public.aevonsmp_forum_threads alter column charge_kind set default 'free';
alter table public.aevonsmp_forum_threads alter column charge_kind set not null;
alter table public.aevonsmp_forum_threads drop constraint if exists aevonsmp_forum_threads_charge_kind_check;
alter table public.aevonsmp_forum_threads add constraint aevonsmp_forum_threads_charge_kind_check check(charge_kind in ('free','credit'));

alter table public.aevonsmp_forum_replies add column if not exists parent_reply_id uuid references public.aevonsmp_forum_replies(id) on delete cascade;
create index if not exists aevonsmp_forum_replies_parent_idx on public.aevonsmp_forum_replies(parent_reply_id);

create table if not exists public.aevonsmp_forum_reactions(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 thread_id uuid references public.aevonsmp_forum_threads(id) on delete cascade,
 reply_id uuid references public.aevonsmp_forum_replies(id) on delete cascade,
 reaction text not null check(reaction in ('like','heart','laugh','wow','sad')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint aevonsmp_forum_reactions_one_target check((thread_id is not null and reply_id is null) or (thread_id is null and reply_id is not null))
);
create unique index if not exists aevonsmp_forum_reactions_thread_user_unique on public.aevonsmp_forum_reactions(user_id,thread_id) where thread_id is not null;
create unique index if not exists aevonsmp_forum_reactions_reply_user_unique on public.aevonsmp_forum_reactions(user_id,reply_id) where reply_id is not null;
create index if not exists aevonsmp_forum_reactions_thread_idx on public.aevonsmp_forum_reactions(thread_id);
create index if not exists aevonsmp_forum_reactions_reply_idx on public.aevonsmp_forum_reactions(reply_id);
alter table public.aevonsmp_forum_reactions enable row level security;
drop policy if exists forum_reactions_public_read on public.aevonsmp_forum_reactions;
create policy forum_reactions_public_read on public.aevonsmp_forum_reactions for select using(true);

create or replace function public.create_aevonsmp_forum_thread(p_user_id uuid,p_title text,p_body text)
returns public.aevonsmp_forum_threads language plpgsql security definer set search_path=public as $$
declare w public.aevonsmp_forum_wallets; t public.aevonsmp_forum_threads; entitlement text;
begin
 if p_user_id is null then raise exception 'Authentication required.'; end if;
 if char_length(trim(coalesce(p_title,'')))<3 then raise exception 'Title must be at least 3 characters.'; end if;
 if char_length(trim(coalesce(p_body,'')))<1 then raise exception 'Post cannot be empty.'; end if;
 if char_length(trim(p_title))>120 then raise exception 'Title is too long.'; end if;
 if char_length(p_body)>10000 then raise exception 'Post is too long.'; end if;
 insert into public.aevonsmp_forum_wallets(user_id) values(p_user_id) on conflict(user_id) do nothing;
 select * into w from public.aevonsmp_forum_wallets where user_id=p_user_id for update;
 if w.free_threads_remaining<=0 and w.credits<=0 then raise exception 'NO_FORUM_CREDITS'; end if;
 entitlement:=case when w.free_threads_remaining>0 then 'free' else 'credit' end;
 insert into public.aevonsmp_forum_threads(user_id,title,body,charge_kind) values(p_user_id,trim(p_title),trim(p_body),entitlement) returning * into t;
 if entitlement='free' then
  update public.aevonsmp_forum_wallets set free_threads_remaining=0,total_threads_created=total_threads_created+1,updated_at=now() where user_id=p_user_id;
 else
  update public.aevonsmp_forum_wallets set credits=credits-1,total_threads_created=total_threads_created+1,updated_at=now() where user_id=p_user_id;
  insert into public.aevonsmp_forum_credit_ledger(user_id,amount,entry_type,thread_id,note) values(p_user_id,-1,'thread_charge',t.id,'Forum thread creation');
 end if;
 return t;
end; $$;

create or replace function public.delete_aevonsmp_forum_thread(p_actor_user_id uuid,p_thread_id uuid,p_is_admin boolean default false)
returns public.aevonsmp_forum_wallets language plpgsql security definer set search_path=public as $$
declare t public.aevonsmp_forum_threads; w public.aevonsmp_forum_wallets;
begin
 select * into t from public.aevonsmp_forum_threads where id=p_thread_id for update;
 if t.id is null then raise exception 'Thread not found.'; end if;
 if not p_is_admin and t.user_id<>p_actor_user_id then raise exception 'You can only delete your own forum posts.'; end if;
 insert into public.aevonsmp_forum_wallets(user_id) values(t.user_id) on conflict(user_id) do nothing;
 select * into w from public.aevonsmp_forum_wallets where user_id=t.user_id for update;
 if t.charge_kind='free' then
  update public.aevonsmp_forum_wallets set free_threads_remaining=1,updated_at=now() where user_id=t.user_id;
 else
  update public.aevonsmp_forum_wallets set credits=credits+1,updated_at=now() where user_id=t.user_id;
 end if;
 delete from public.aevonsmp_forum_threads where id=t.id;
 select * into w from public.aevonsmp_forum_wallets where user_id=t.user_id;
 return w;
end; $$;

grant execute on function public.create_aevonsmp_forum_thread(uuid,text,text) to service_role;
grant execute on function public.delete_aevonsmp_forum_thread(uuid,uuid,boolean) to service_role;
