# Admin / Profile / GCash repair

This build fixes three reported issues:

1. Admin visibility now uses a protected server-side role lookup, so browser RLS or optional profile fields cannot hide the Admin tab.
2. Nickname/profile picture/password updates use protected server routes. Email changes still use Supabase's confirmation flow.
3. The GCash payment method is forced to use the bundled `public/assets/gcash-qr.jpg` (the user's latest uploaded QR), with a cache-busting URL and a larger display size.

## One Supabase repair step
Run `supabase/repair-account-admin-profile.sql` once in Supabase SQL Editor. It is idempotent and does not change any user's existing role.
