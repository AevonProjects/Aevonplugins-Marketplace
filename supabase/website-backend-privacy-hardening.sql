-- AevonPlugins website-only backend/privacy hardening
-- Deploy the matching website update BEFORE running this SQL.

-- Browser roles should never directly read or write private ownership/license records.
alter table public.user_plugins enable row level security;
revoke all on table public.user_plugins from anon;
revoke insert, update, delete on table public.user_plugins from authenticated;
revoke select on table public.user_plugins from authenticated;

alter table public.licenses enable row level security;
revoke all on table public.licenses from anon;
revoke insert, update, delete, select on table public.licenses from authenticated;

-- Orders are accessed through authenticated server APIs only.
alter table public.marketplace_orders enable row level security;
revoke all on table public.marketplace_orders from anon;
revoke insert, update, delete, select on table public.marketplace_orders from authenticated;

alter table public.aevonsmp_orders enable row level security;
revoke all on table public.aevonsmp_orders from anon;
revoke insert, update, delete, select on table public.aevonsmp_orders from authenticated;

-- Private GCash ticket records/messages are server-API only.
alter table public.gcash_tickets enable row level security;
revoke all on table public.gcash_tickets from anon;
revoke insert, update, delete, select on table public.gcash_tickets from authenticated;

alter table public.gcash_ticket_messages enable row level security;
revoke all on table public.gcash_ticket_messages from anon;
revoke insert, update, delete, select on table public.gcash_ticket_messages from authenticated;

-- Identity-verification applications must never be directly queryable from browser roles.
alter table public.verification_applications enable row level security;
revoke all on table public.verification_applications from anon, authenticated;

-- Reviews remain visible only through the sanitized website API so internal auth UUIDs are not exposed.
alter table public.plugin_reviews enable row level security;
revoke all on table public.plugin_reviews from anon, authenticated;

alter table public.plugin_review_replies enable row level security;
revoke all on table public.plugin_review_replies from anon, authenticated;

-- Public marketplace release history is read-only and exposes only published releases via RLS.
alter table public.plugin_versions enable row level security;
revoke insert, update, delete on table public.plugin_versions from anon, authenticated;
grant select on table public.plugin_versions to anon, authenticated;
drop policy if exists "Public read published plugin versions" on public.plugin_versions;
create policy "Public read published plugin versions"
on public.plugin_versions for select to anon, authenticated
using (is_published = true);

-- Profiles remain directly readable only by their owner. Public review/profile presentation goes through server APIs.
alter table public.profiles enable row level security;
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

-- Explicitly keep sensitive Storage buckets private.
update storage.buckets
set public = false
where id in (
  'plugin-files',
  'verification-documents',
  'account-verification',
  'gcash-ticket-images',
  'gcash-ticket-media'
);

notify pgrst, 'reload schema';
