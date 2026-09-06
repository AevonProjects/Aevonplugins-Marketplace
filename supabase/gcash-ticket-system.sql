-- Aevon Marketplace: private GCash payment tickets + admin history controls
-- Run once in Supabase SQL Editor.

create table if not exists public.gcash_tickets (
  id uuid primary key default gen_random_uuid(),
  order_kind text not null check (order_kind in ('marketplace','aevonsmp')),
  order_id uuid not null,
  order_code text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_email text not null,
  product_name text not null,
  amount numeric(10,2) not null,
  subject text not null,
  status text not null default 'open' check (status in ('open','approved','rejected','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_kind, order_id)
);

create table if not exists public.gcash_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.gcash_tickets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('buyer','admin')),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists gcash_tickets_user_idx on public.gcash_tickets(user_id, created_at desc);
create index if not exists gcash_tickets_status_idx on public.gcash_tickets(status, updated_at desc);
create index if not exists gcash_ticket_messages_ticket_idx on public.gcash_ticket_messages(ticket_id, created_at asc);

alter table public.gcash_tickets enable row level security;
alter table public.gcash_ticket_messages enable row level security;

revoke insert, update, delete on public.gcash_tickets from anon, authenticated;
revoke insert, update, delete on public.gcash_ticket_messages from anon, authenticated;
grant select on public.gcash_tickets to authenticated;
grant select on public.gcash_ticket_messages to authenticated;

drop policy if exists "Buyer can view own GCash tickets" on public.gcash_tickets;
create policy "Buyer can view own GCash tickets"
on public.gcash_tickets for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Buyer can view messages on own GCash tickets" on public.gcash_ticket_messages;
create policy "Buyer can view messages on own GCash tickets"
on public.gcash_ticket_messages for select to authenticated
using (
  exists (
    select 1 from public.gcash_tickets t
    where t.id = ticket_id
      and (t.user_id = auth.uid() or public.is_admin())
  )
);

alter table public.marketplace_orders
  add column if not exists admin_hidden boolean not null default false;

alter table public.aevonsmp_orders
  add column if not exists admin_hidden boolean not null default false;

create index if not exists marketplace_orders_admin_hidden_idx
  on public.marketplace_orders(admin_hidden, created_at desc);

create index if not exists aevonsmp_orders_admin_hidden_idx
  on public.aevonsmp_orders(admin_hidden, created_at desc);
