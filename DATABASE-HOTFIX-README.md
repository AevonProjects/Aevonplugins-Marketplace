# Database Hotfix

If the marketplace shows either of these errors:

- `column licenses.server_ip does not exist`
- `column verification_applications.rejection_reason does not exist`

open Supabase -> SQL Editor and run `supabase/FIX-MISSING-COLUMNS.sql` once.

The SQL is idempotent (`IF NOT EXISTS`) and can safely be run again. The website code also includes temporary compatibility fallbacks so older schemas no longer crash the Licenses and Verification screens while the migration is being applied.
