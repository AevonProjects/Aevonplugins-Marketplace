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

-- AevonSMP affiliate discount codes + commission wallet
create table if not exists public.aevonsmp_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  commission_percent numeric(5,2) not null default 5 check (commission_percent >= 0 and commission_percent <= 100),
  status text not null default 'active' check (status in ('active','disabled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists aevonsmp_discount_owner_unique on public.aevonsmp_discount_codes(owner_user_id);
create index if not exists aevonsmp_discount_code_lookup_idx on public.aevonsmp_discount_codes(lower(code));

alter table public.aevonsmp_orders add column if not exists subtotal numeric(10,2);
alter table public.aevonsmp_orders add column if not exists discount_code_id uuid references public.aevonsmp_discount_codes(id) on delete set null;
alter table public.aevonsmp_orders add column if not exists discount_code text;
alter table public.aevonsmp_orders add column if not exists discount_percent numeric(5,2) not null default 0;
alter table public.aevonsmp_orders add column if not exists discount_amount numeric(10,2) not null default 0;
alter table public.aevonsmp_orders add column if not exists commission_percent numeric(5,2) not null default 0;
alter table public.aevonsmp_orders add column if not exists commission_amount numeric(10,2) not null default 0;
update public.aevonsmp_orders set subtotal = amount where subtotal is null;

create table if not exists public.aevonsmp_discount_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.aevonsmp_orders(id) on delete cascade,
  discount_code_id uuid not null references public.aevonsmp_discount_codes(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  minecraft_ign text not null,
  order_amount numeric(10,2) not null,
  commission_percent numeric(5,2) not null,
  commission_amount numeric(10,2) not null,
  status text not null default 'credited' check (status in ('credited','reversed')),
  created_at timestamptz not null default now()
);

create table if not exists public.aevonsmp_commission_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  balance numeric(12,2) not null default 0,
  lifetime_earned numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.credit_aevonsmp_discount_commission(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.aevonsmp_orders%rowtype;
  d public.aevonsmp_discount_codes%rowtype;
  inserted_count integer;
begin
  select * into o from public.aevonsmp_orders where id = p_order_id for update;
  if not found or o.discount_code_id is null or coalesce(o.commission_amount,0) <= 0 then return false; end if;
  if o.payment_status not in ('paid','approved') then return false; end if;
  select * into d from public.aevonsmp_discount_codes where id = o.discount_code_id;
  if not found or d.owner_user_id = o.user_id then return false; end if;

  insert into public.aevonsmp_discount_commissions(order_id,discount_code_id,owner_user_id,owner_email,buyer_user_id,minecraft_ign,order_amount,commission_percent,commission_amount)
  values(o.id,d.id,d.owner_user_id,d.owner_email,o.user_id,o.minecraft_ign,o.amount,o.commission_percent,o.commission_amount)
  on conflict(order_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return false; end if;

  insert into public.aevonsmp_commission_wallets(user_id,email,balance,lifetime_earned,updated_at)
  values(d.owner_user_id,d.owner_email,o.commission_amount,o.commission_amount,now())
  on conflict(user_id) do update set
    email=excluded.email,
    balance=aevonsmp_commission_wallets.balance + excluded.balance,
    lifetime_earned=aevonsmp_commission_wallets.lifetime_earned + excluded.lifetime_earned,
    updated_at=now();
  return true;
end;
$$;

alter table public.aevonsmp_discount_codes enable row level security;
alter table public.aevonsmp_discount_commissions enable row level security;
alter table public.aevonsmp_commission_wallets enable row level security;
revoke insert, update, delete on public.aevonsmp_discount_codes from anon, authenticated;
revoke insert, update, delete on public.aevonsmp_discount_commissions from anon, authenticated;
revoke insert, update, delete on public.aevonsmp_commission_wallets from anon, authenticated;

drop policy if exists "Users can view own AevonSMP discount code" on public.aevonsmp_discount_codes;
create policy "Users can view own AevonSMP discount code" on public.aevonsmp_discount_codes for select to authenticated using (auth.uid() = owner_user_id);
drop policy if exists "Users can view own AevonSMP commissions" on public.aevonsmp_discount_commissions;
create policy "Users can view own AevonSMP commissions" on public.aevonsmp_discount_commissions for select to authenticated using (auth.uid() = owner_user_id);
drop policy if exists "Users can view own AevonSMP commission wallet" on public.aevonsmp_commission_wallets;
create policy "Users can view own AevonSMP commission wallet" on public.aevonsmp_commission_wallets for select to authenticated using (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';


-- Global discount-code support for AevonPlugins marketplace purchases
alter table public.marketplace_orders add column if not exists subtotal numeric(10,2);
alter table public.marketplace_orders add column if not exists discount_code_id uuid references public.aevonsmp_discount_codes(id) on delete set null;
alter table public.marketplace_orders add column if not exists discount_code text;
alter table public.marketplace_orders add column if not exists discount_percent numeric(5,2) not null default 0;
alter table public.marketplace_orders add column if not exists discount_amount numeric(10,2) not null default 0;
alter table public.marketplace_orders add column if not exists commission_percent numeric(5,2) not null default 0;
alter table public.marketplace_orders add column if not exists commission_amount numeric(10,2) not null default 0;
update public.marketplace_orders set subtotal = amount where subtotal is null;

create table if not exists public.marketplace_discount_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.marketplace_orders(id) on delete cascade,
  discount_code_id uuid not null references public.aevonsmp_discount_codes(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  order_amount numeric(10,2) not null,
  commission_percent numeric(5,2) not null,
  commission_amount numeric(10,2) not null,
  status text not null default 'credited' check (status in ('credited','reversed')),
  created_at timestamptz not null default now()
);

create or replace function public.credit_marketplace_discount_commission(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.marketplace_orders%rowtype;
  d public.aevonsmp_discount_codes%rowtype;
  inserted_count integer;
begin
  select * into o from public.marketplace_orders where id = p_order_id for update;
  if not found or o.discount_code_id is null or coalesce(o.commission_amount,0) <= 0 then return false; end if;
  if o.status not in ('paid','approved') then return false; end if;
  select * into d from public.aevonsmp_discount_codes where id = o.discount_code_id;
  if not found or d.owner_user_id = o.user_id then return false; end if;

  insert into public.marketplace_discount_commissions(order_id,discount_code_id,owner_user_id,owner_email,buyer_user_id,order_amount,commission_percent,commission_amount)
  values(o.id,d.id,d.owner_user_id,d.owner_email,o.user_id,o.amount,o.commission_percent,o.commission_amount)
  on conflict(order_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return false; end if;

  insert into public.aevonsmp_commission_wallets(user_id,email,balance,lifetime_earned,updated_at)
  values(d.owner_user_id,d.owner_email,o.commission_amount,o.commission_amount,now())
  on conflict(user_id) do update set
    email=excluded.email,
    balance=aevonsmp_commission_wallets.balance + excluded.balance,
    lifetime_earned=aevonsmp_commission_wallets.lifetime_earned + excluded.lifetime_earned,
    updated_at=now();
  return true;
end;
$$;

alter table public.marketplace_discount_commissions enable row level security;
revoke insert, update, delete on public.marketplace_discount_commissions from anon, authenticated;
drop policy if exists "Users can view own marketplace commissions" on public.marketplace_discount_commissions;
create policy "Users can view own marketplace commissions" on public.marketplace_discount_commissions for select to authenticated using (auth.uid() = owner_user_id);

NOTIFY pgrst, 'reload schema';
