# Aevon Marketplace Runtime Plugin Licensing

This build adds a server-side license validation endpoint for ALicense.

## Required Supabase migration
Run `supabase/marketplace-plugin-license-activation.sql` once in Supabase SQL Editor.

## Runtime flow
1. Customer purchases or receives ALicense and gets an AEVN license key.
2. ALicense creates `LicenseKey: ""` in `plugins/ALicense/config.yml` if missing.
3. Customer pastes the marketplace license key and restarts the server.
4. The plugin calls `/api/license/validate` over HTTPS.
5. On first successful validation the license is bound to an opaque installation UUID.
6. The same key is rejected from a different installation.
7. ALicense revalidates every 6 hours and has a 48-hour verified grace cache for temporary marketplace outages.

ACore remains a hard dependency in plugin.yml.
