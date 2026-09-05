# AevonSMP Admin Post Controls Fix

This update fixes the forum moderation controls.

- Only users whose `profiles.role` is `admin` can see or use Pin/Unpin and Delete controls.
- Regular users can no longer delete their own posts.
- Admin controls are visible directly on community post cards in both the AevonSMP homepage feed and the full Community Posts page.
- The API also enforces admin-only deletion and pinning, so hiding buttons is not the only protection.
- When an admin deletes a post, its original posting entitlement is restored to the post owner (free-post entitlement or one paid Forum Credit).
- Pinning remains single-featured-post behavior: pinning a new post automatically unpins the previous pinned post.

No new Supabase SQL is required if the previous pinned-post SQL update has already been run.
