create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  customer_email text not null,
  payment_method text not null check (payment_method in ('gcash', 'paypal')),
  amount numeric(10,2) not null,
  currency text not null default 'PHP',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid', 'cancelled')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists marketplace_orders_user_id_idx on public.marketplace_orders(user_id);
create index if not exists marketplace_orders_plugin_id_idx on public.marketplace_orders(plugin_id);
create index if not exists marketplace_orders_status_idx on public.marketplace_orders(status);

alter table public.marketplace_orders enable row level security;

revoke insert, update, delete on table public.marketplace_orders from anon, authenticated;
grant select on table public.marketplace_orders to authenticated;

drop policy if exists "Users can view own marketplace orders" on public.marketplace_orders;
create policy "Users can view own marketplace orders"
on public.marketplace_orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can view all marketplace orders" on public.marketplace_orders;
create policy "Admins can view all marketplace orders"
on public.marketplace_orders
for select
to authenticated
using (public.is_admin());
