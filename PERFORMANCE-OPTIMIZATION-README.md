# AevonPlugins Whole-Site Performance Optimization

This update is based on the current Privacy-Hardened v2 website and does not remove or redesign features.

Optimizations included:
- Marketplace public product/version data is now served by one server API with a short 60-second CDN cache.
- Marketplace ownership lookup runs in parallel instead of after public product queries.
- Forum feed default payload reduced from 30 to 12 posts per request.
- Forum profile/reply/reaction decoration queries run in parallel.
- Forum GET no longer performs a database UPSERT on every page view.
- Forum wallet + role reads run in parallel.
- AevonSMP public store/status response gets a very short edge cache.
- AevonSMP automatic refresh is reduced from every 10 seconds to every 15 seconds to cut background request contention while keeping status fresh.
- Non-critical feed/shop images use lazy loading and async decoding.
- Supabase connection preconnect/DNS hints are added.
- Additional indexes are supplied for the most common marketplace, ownership, license, forum, ticket, and order lookups.

INSTALL:
1. Deploy the website update first.
2. Confirm Vercel build succeeds.
3. Test Marketplace, plugin pages, AevonSMP, forum, My Account, Library, Licenses, GCash tickets and Admin.
4. Then run `supabase/performance-optimization-2026-09.sql` in Supabase SQL Editor.
5. Test again.

No existing security/privacy SQL should be removed or rolled back.
