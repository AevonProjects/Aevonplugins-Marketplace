-- PayPal automatic checkout support for Aevon Marketplace.
-- Safe to run more than once.
alter table public.marketplace_orders
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text,
  add column if not exists paid_at timestamptz;

create unique index if not exists marketplace_orders_paypal_order_id_unique
  on public.marketplace_orders (paypal_order_id)
  where paypal_order_id is not null;

create unique index if not exists marketplace_orders_paypal_capture_id_unique
  on public.marketplace_orders (paypal_capture_id)
  where paypal_capture_id is not null;
