# Aevon Plugins Marketplace V2

Next.js + Supabase marketplace starter for Aevon plugins.

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Admin dashboard update

The Admin Dashboard supports:

- Create plugin
- Edit plugin
- Publish / unpublish
- Delete plugin (with confirmation)
- Duplicate-slug error feedback
- Success/error status messages
- Refresh/list existing plugins

### Required one-time Supabase policy

Run the SQL in:

`supabase/admin-plugin-select-policy.sql`

This allows admins to see both draft and published plugins while normal visitors can still only see published listings.
