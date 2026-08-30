# Plugin Version History Setup

## 1. Supabase migration
Run `supabase/plugin-version-history.sql` in Supabase → SQL Editor → New query.

This creates `public.plugin_versions`, imports each plugin's currently uploaded JAR as its first archived release, and keeps the existing `plugins.file_*` fields as the latest-version pointer for backwards compatibility.

## 2. Deploy the website
Upload this package to the existing GitHub repository and let Vercel redeploy.

## 3. Publishing a new plugin update
Admin → Manage Plugins → **New Release** → enter a new Plugin Version → select release type → add release notes/changelog → choose the new JAR → **Save Plugin**.

Every new JAR release must use a unique version number. The previous JAR is not overwritten.

## Customer behavior
- Everyone can read Version History/changelogs on the plugin page.
- Only owners with an active plugin license can download any release.
- The normal Download button always downloads the latest release.
- Older releases remain downloadable from Version History.
- The same plugin license covers all versions of the same plugin.
