# Aevon Marketplace Security Hardening

## Apply in this order
1. Deploy the website files in this patch to Vercel.
2. Confirm the deployment succeeds and Admin > Plugins loads.
3. In Supabase SQL Editor, run `supabase/security-hardening-2026-09.sql` once.
4. In Supabase Security Advisor, review every remaining warning. Do not disable RLS to fix application errors.
5. Rotate `SUPABASE_SERVICE_ROLE_KEY`/secret key, `AEVONSMP_BRIDGE_SECRET`, PayPal secret, and other server secrets if any have ever been pasted into source control, chat screenshots, logs, or public repositories. Update Vercel/server environment variables immediately after rotation.

## What this patch changes
- Plugin create/update/delete and draft listing now go through authenticated server-side admin APIs.
- Browser roles lose INSERT/UPDATE/DELETE privileges on `plugins` and `profiles`.
- Rich plugin HTML is sanitized again on the server.
- Security headers are applied globally (CSP, anti-framing, HSTS, nosniff, referrer and permissions policies).
- Forum uploads use an explicit image/video MIME allowlist; SVG is blocked.
- Profile avatar URLs are restricted to the signed-in user's own Aevon Supabase avatar folder.
- Sensitive Storage buckets are forced private by the SQL migration.

## Important
This is hardening, not a claim that a public website can be made impossible to compromise. Keep Next.js/Supabase dependencies patched, use MFA on Vercel/Supabase/GitHub/PayPal, and periodically review Supabase Security Advisor and Vercel logs.
