# Latest Version Priority

The newest release marked `is_latest = true` in `plugin_versions` is now the source of truth for plugin titles.

Example:
- Existing plugin: ALicense v1.1.1
- Admin uploads release 1.1.2
- Version History marks 1.1.2 as latest
- Marketplace, plugin resource page, and Admin listing display **ALicense v1.1.2** automatically.

The upload route also synchronizes `plugins.version` to the new release for compatibility with other marketplace features.

No new SQL migration is required if the plugin version-history table already exists.
