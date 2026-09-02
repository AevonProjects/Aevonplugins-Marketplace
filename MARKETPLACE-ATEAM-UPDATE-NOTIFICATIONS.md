# ATeam Marketplace Update Notifications

This build adds a public, read-only update metadata endpoint at `/api/plugin-update`.

Example:
`GET /api/plugin-update?product=ATeam&current=1.3.18`

The endpoint returns the latest published `plugin_versions` release for ATeam. It never returns a license key or a plugin download URL.

The normal `/api/license/validate` response now also includes `latestVersion`, `latestReleaseType`, and `updateAvailable` as informational fields.

ATeam 1.3.18 checks the update endpoint on startup and every 6 hours by default. When a newer version is published it notifies console and online administrators with `ateam.admin`. It does not overwrite or auto-download the server JAR.
