# AevonSMP Forum Social Update

This update adds:

- Comments on forum threads.
- Replies to individual comments (nested discussions).
- Post/comment reactions: Like, Heart, Laugh, Wow, and Sad.
- Thread owners may delete their own threads.
- Admin accounts may delete any thread.
- Deleting a thread removes its comments/reactions automatically.
- Deleting a FREE thread restores the account's one free-post entitlement.
- Deleting a CREDIT thread returns exactly 1 Forum Credit to the thread owner.
- Comments, nested replies, and reactions never consume credits.

## Required database update

If the original forum SQL was already run, execute:

`supabase/aevonsmp-forum-social-update.sql`

For a fresh install, the main `supabase/aevonsmp-forum.sql` also includes this update.

## Posting entitlement behavior

Each account receives one reusable free-thread entitlement. It may have one thread created with that entitlement at a time. If that thread is deleted, the free entitlement becomes available again.

Additional threads consume one Forum Credit each. If a paid thread is deleted, the credit it consumed is returned.
