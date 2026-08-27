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

## Account registration security update

This build adds:
- Header account display using the authenticated user's email plus a sign-out menu.
- Registration with mandatory Supabase email confirmation.
- Forgot-password / password-recovery flow.
- Server-side one-registration-per-IP enforcement using a keyed HMAC (raw IPs are not stored).
- Server-side VPN/proxy reputation blocking through proxycheck.io.

Before public registration works:
1. Run `supabase/registration-security.sql` in the Supabase SQL Editor.
2. In Supabase Authentication settings, keep **Confirm email** enabled and configure your production Site URL / redirect URL.
3. Add these Vercel environment variables as server-only secrets: `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SECRET`, and `PROXYCHECK_API_KEY`.
4. Redeploy after adding environment variables.

`SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SECRET`, and `PROXYCHECK_API_KEY` must never be exposed as `NEXT_PUBLIC_` variables.

One-account-per-IP is intentionally strict and can block multiple legitimate people sharing the same public IP (households, schools, cafes, carrier-grade NAT). VPN/proxy detection is reputation-based and cannot guarantee detection of every anonymizing connection.
