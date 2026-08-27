# Aevon Plugins Marketplace V2

Next.js + Supabase marketplace starter for AevonProjects.

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Both are browser-safe values when using Supabase's publishable key and proper RLS.

## Deploy

1. Upload all files/folders in this project to the root of your GitHub repository.
2. Commit to `main`.
3. Vercel automatically redeploys the connected project.
4. Open `/login` and sign in with the admin account created in Supabase.
5. Open `/admin` to add the first published plugin.

## Important

Never expose a Supabase `service_role` or `sb_secret_...` key in a `NEXT_PUBLIC_...` variable.
