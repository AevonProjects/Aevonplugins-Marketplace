# AevonSMP Forum Pin Update

Admins can now pin and unpin community posts.

- Pin/Unpin controls are only rendered for users whose profile role is `admin`.
- The API also validates the admin role server-side.
- Pinned posts are sorted before all regular posts on both the AevonSMP homepage feed and the full Community feed.
- Only one post can be pinned at a time. Pinning a new post automatically unpins the previous featured post, guaranteeing one #1 post at the top.
- Run `supabase/aevonsmp-forum-pin-update.sql` once for existing installations. The main forum schema already contains `is_pinned` for fresh installations.
