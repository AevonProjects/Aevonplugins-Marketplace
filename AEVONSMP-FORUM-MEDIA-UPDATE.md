# AevonSMP Forum Media Update

Forum threads now support optional media attachments:

- Maximum **1 picture per thread**.
- Maximum **1 video per thread**.
- Pictures accept browser-supported `image/*` formats.
- Videos accept browser-supported `video/*` formats and are limited to **20 MB**.
- Media uploads are validated by the server before Supabase Storage issues an upload token.
- The Storage bucket `aevonsmp-forum-media` is created automatically when the first upload is prepared, using the existing Supabase service-role configuration.
- Deleting a forum thread also attempts to remove its attached image/video from Storage.
- Comments and nested replies remain text-only; this update applies to the original forum post/thread.

## Existing installations

Run this once in Supabase SQL Editor:

`supabase/aevonsmp-forum-media-update.sql`

No Minecraft plugin update is required.
