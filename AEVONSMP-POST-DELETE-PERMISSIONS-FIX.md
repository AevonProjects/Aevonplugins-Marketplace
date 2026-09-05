# AevonSMP Post Delete Permissions Fix

- Regular users can delete only posts they created.
- Admin users can delete any post.
- Only admins can pin or unpin posts.
- Deleting a free post restores the owner's free-post entitlement.
- Deleting a credit-funded post returns that 1 Forum Credit to the owner.
- The backend enforces ownership; this is not only a UI restriction.

No additional Supabase SQL migration is required if the forum/social SQL updates were already applied.
