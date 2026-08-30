-- Run once in Supabase SQL Editor before deploying the updated marketplace.
-- The UUID remains the actual one-server security binding. server_ip is display/audit metadata only.

alter table public.licenses
  add column if not exists server_ip text;

comment on column public.licenses.server_ip is
  'Observed public IP from the last successful license validation. Informational only; server_id is the security binding.';
