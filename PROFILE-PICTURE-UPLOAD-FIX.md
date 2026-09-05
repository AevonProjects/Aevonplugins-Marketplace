# Profile Picture Upload Fix

This update fixes the Account page error:

`The related resource does not exist`

## Cause

The profile upload API expected the Supabase Storage bucket `profile-avatars` to already exist. On an installation where the storage migration had not been run (or the bucket had been removed), Supabase rejected the signed upload request.

## Fix

The server-side avatar endpoint now checks `profile-avatars` before every upload request. If the bucket is missing, it creates it automatically using the configured Supabase service-role connection.

The bucket is created as public and accepts JPG, PNG and WEBP images up to 5 MB.

## Required Vercel variables

The website still needs the existing variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

No new environment variable is required for this fix.

## Optional database repair

`supabase/repair-account-admin-profile.sql` remains safe to run and creates the same `profile-avatars` bucket plus the browser storage policies. The website no longer depends on the bucket having been created manually before a user uploads an avatar.
