# Website Backend Privacy Hardening

This update is specifically for preventing technical visitors and normal users from learning or querying sensitive backend data.

What it changes:
- No service-role/PayPal/private secret is moved to the browser.
- Server-only secret modules are marked server-only.
- My Library, Licenses, plugin ownership, and Admin GCash order history no longer query sensitive Supabase tables directly from browser code.
- Raw Supabase/Postgres error messages are hidden on the patched routes.
- Public review responses no longer expose Supabase/Auth user UUIDs or admin UUIDs.
- Sensitive tables are revoked from browser roles in the supplied SQL.
- Private Storage buckets are explicitly kept private.

Important:
The Supabase project URL and NEXT_PUBLIC_SUPABASE_ANON_KEY will still be visible in browser DevTools. This is expected for Supabase browser authentication. They are not secret credentials. The security boundary is the server APIs + RLS/grants.

INSTALL ORDER:
1. Deploy this website update to Vercel.
2. Confirm build succeeds.
3. Test Login, Marketplace, My Library, Licenses, plugin page, Admin GCash order history, reviews, GCash tickets.
4. Only then run `supabase/website-backend-privacy-hardening.sql`.
5. Test the same features again.

Do not run the SQL before the matching website update is deployed because the migration intentionally removes direct browser SELECT access to ownership/license/order/ticket/review tables.
