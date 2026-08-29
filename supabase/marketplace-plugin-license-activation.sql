-- Marketplace-backed plugin activation for Aevon plugins.
-- Safe to run more than once.

alter table public.licenses
  add column if not exists server_id text,
  add column if not exists activated_at timestamptz,
  add column if not exists last_validated_at timestamptz;

create index if not exists licenses_server_id_idx
  on public.licenses (server_id)
  where server_id is not null;

comment on column public.licenses.server_id is
  'Opaque installation UUID bound on first successful plugin activation.';
comment on column public.licenses.activated_at is
  'Time this marketplace license was first bound to a server installation.';
comment on column public.licenses.last_validated_at is
  'Most recent successful runtime validation from the licensed plugin.';

NOTIFY pgrst, 'reload schema';
