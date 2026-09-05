-- AevonSMP web store + Minecraft delivery bridge
-- Run once in Supabase SQL Editor. Safe to run more than once.

create table if not exists public.aevonsmp_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  reward_command text not null,
  command_mode text not null default 'once' check (command_mode in ('once','per_quantity')),
  required_free_slots integer not null default 0 check (required_free_slots between 0 and 36),
  max_quantity integer not null default 64 check (max_quantity between 1 and 999),
  image_url text,
  status text not null default 'published' check (status in ('draft','published')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aevonsmp_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_email text not null,
  product_id uuid references public.aevonsmp_products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity integer not null check (quantity between 1 and 999),
  amount numeric(10,2) not null,
  currency text not null default 'PHP',
  minecraft_ign text not null,
  reward_command text not null,
  command_mode text not null default 'once' check (command_mode in ('once','per_quantity')),
  required_free_slots integer not null default 0,
  payment_method text not null check (payment_method in ('paypal','gcash')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','approved','rejected','cancelled')),
  delivery_status text not null default 'awaiting_payment' check (delivery_status in ('awaiting_payment','payment_confirmed','waiting_player','waiting_inventory','processing','delivered','failed','cancelled')),
  paypal_order_id text,
  paypal_capture_id text,
  admin_note text,
  delivery_message text,
  claimed_at timestamptz,
  paid_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists aevonsmp_orders_paypal_order_unique on public.aevonsmp_orders(paypal_order_id) where paypal_order_id is not null;
create unique index if not exists aevonsmp_orders_paypal_capture_unique on public.aevonsmp_orders(paypal_capture_id) where paypal_capture_id is not null;
create index if not exists aevonsmp_orders_delivery_idx on public.aevonsmp_orders(delivery_status, minecraft_ign);
create index if not exists aevonsmp_orders_user_idx on public.aevonsmp_orders(user_id, created_at desc);

create table if not exists public.aevonsmp_server_status (
  server_id text primary key,
  server_name text not null default 'AevonSMP',
  server_address text not null default 'aevonsmp.online',
  online boolean not null default false,
  players_online integer not null default 0,
  players_max integer not null default 0,
  player_names jsonb not null default '[]'::jsonb,
  minecraft_version text,
  plugin_version text,
  last_seen_at timestamptz not null default now()
);

alter table public.aevonsmp_products enable row level security;
alter table public.aevonsmp_orders enable row level security;
alter table public.aevonsmp_server_status enable row level security;

revoke insert, update, delete on public.aevonsmp_products from anon, authenticated;
revoke insert, update, delete on public.aevonsmp_orders from anon, authenticated;
revoke insert, update, delete on public.aevonsmp_server_status from anon, authenticated;

drop policy if exists "Public can view published AevonSMP products" on public.aevonsmp_products;
create policy "Public can view published AevonSMP products" on public.aevonsmp_products for select using (status = 'published');

drop policy if exists "Users can view own AevonSMP orders" on public.aevonsmp_orders;
create policy "Users can view own AevonSMP orders" on public.aevonsmp_orders for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Public can view AevonSMP status" on public.aevonsmp_server_status;
create policy "Public can view AevonSMP status" on public.aevonsmp_server_status for select using (true);

NOTIFY pgrst, 'reload schema';
