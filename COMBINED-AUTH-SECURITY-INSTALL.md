# AevonPlugins Combined Auth + Security Update

This package combines:
1. Login/session fix
2. Email-verification + resend-verification fix
3. Server-side plugin administration
4. Database/RLS security hardening
5. Security headers / CSP
6. Server-side rich HTML sanitization
7. Safer forum upload validation
8. Profile-avatar URL restrictions

## IMPORTANT ORDER
DO NOT run the Supabase security SQL before the updated website is deployed successfully.

### Phase 1 — Website deployment
Replace the repository with this merged website, or copy the files from the patch ZIP.
Set this Vercel environment variable:
NEXT_PUBLIC_SITE_URL=https://www.aevonplugins.shop

Keep your existing Supabase, Resend SMTP, PayPal and other environment variables unchanged.

Deploy to Vercel and make sure the build succeeds.

### Phase 2 — Auth configuration
In Supabase Authentication -> URL Configuration:
Site URL:
https://www.aevonplugins.shop

Redirect URLs:
https://www.aevonplugins.shop/**
https://aevonplugins.shop/**

Custom SMTP should remain enabled with Resend.

### Phase 3 — Test before database lock-down
Before running the SQL:
- Register a fresh test account.
- Receive the verification email.
- Click the verification link.
- Log in.
- Confirm the account/profile page recognizes the session.
- Log in as admin.
- Confirm Admin -> Plugins loads.
- Create/edit a temporary test plugin if desired.

### Phase 4 — Apply database hardening
Only after Phase 3 works:
Open Supabase -> SQL Editor and run:
supabase/security-hardening-2026-09.sql

This removes direct browser write access to sensitive tables and relies on the new server-side admin APIs.

### Phase 5 — Test again
After SQL:
- Admin can still add/edit/publish/unpublish/delete plugins.
- Normal users cannot access Admin APIs.
- Registration/login/email verification still work.
- Marketplace/public product browsing still works.
- Purchased plugins and licenses still work.

## Rollback warning
If the website deployment fails, DO NOT run the SQL.
If the SQL has already been applied while the old website is live, old direct-browser plugin admin writes may stop working until the new server-side API build is deployed.
