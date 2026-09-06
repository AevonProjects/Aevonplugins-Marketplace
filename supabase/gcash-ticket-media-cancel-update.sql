-- Aevon Marketplace: GCash ticket media/cancellation/deletion update
-- Run once in Supabase SQL Editor AFTER gcash-ticket-system.sql.

-- Allow cancelled ticket status.
alter table public.gcash_tickets drop constraint if exists gcash_tickets_status_check;
alter table public.gcash_tickets
  add constraint gcash_tickets_status_check
  check (status in ('open','approved','rejected','cancelled','closed'));

-- Optional image attachment for private ticket messages.
alter table public.gcash_ticket_messages
  add column if not exists image_path text;

-- Message text may be empty when an image is attached.
alter table public.gcash_ticket_messages alter column message drop not null;
alter table public.gcash_ticket_messages drop constraint if exists gcash_ticket_messages_message_check;
alter table public.gcash_ticket_messages
  add constraint gcash_ticket_messages_content_check
  check (
    (message is not null and char_length(trim(message)) between 1 and 4000)
    or image_path is not null
  );

-- Private storage bucket for payment-ticket pictures.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gcash-ticket-images',
  'gcash-ticket-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

NOTIFY pgrst, 'reload schema';
