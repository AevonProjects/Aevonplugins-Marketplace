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

## Plugin Detail Update
- Marketplace cards now link to `/plugins/[slug]`.
- Detail pages load published plugin data directly from Supabase.
- Logged-in users can see whether they own the plugin through `user_plugins`.
- Existing license status, key, download count, and last download timestamp are displayed when available.
- Purchase/claim and download actions intentionally remain disabled until the secure transaction/download backend is added.

## Minecraft Storefront Redesign
This build uses the supplied Aevon assets in `public/assets/` and adds a floating, scroll-snap plugin carousel with next/previous controls. Existing Supabase auth, admin management, RLS behavior, plugin detail pages, library, and licenses remain intact.
