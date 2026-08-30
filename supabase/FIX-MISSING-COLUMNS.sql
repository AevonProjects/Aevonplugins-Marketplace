-- Aevon Marketplace hotfix for existing Supabase projects.
-- Safe to run more than once.

-- License server display/audit metadata.
alter table public.licenses
  add column if not exists server_ip text;

comment on column public.licenses.server_ip is
  'Observed public IP from the last successful license validation. Informational only; server_id remains the one-server security binding.';

-- Existing verification_applications tables may predate the newer admin-review fields.
alter table public.verification_applications
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Ensure profile verification fields also exist on older installs.
alter table public.profiles
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verified_at timestamptz;

-- Refresh PostgREST schema cache after structural changes.
notify pgrst, 'reload schema';
