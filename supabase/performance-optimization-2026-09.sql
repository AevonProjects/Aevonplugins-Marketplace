-- AevonPlugins performance optimization indexes
-- Safe/idempotent: no feature or data changes.

create index if not exists plugins_status_created_idx
  on public.plugins(status, created_at desc);

create index if not exists plugin_versions_latest_published_idx
  on public.plugin_versions(plugin_id, is_latest, is_published);

create index if not exists user_plugins_user_access_plugin_idx
  on public.user_plugins(user_id, access_type, plugin_id);

create index if not exists licenses_user_plugin_created_idx
  on public.licenses(user_id, plugin_id, created_at desc);

create index if not exists aevonsmp_forum_threads_visible_feed_idx
  on public.aevonsmp_forum_threads(status, is_pinned desc, created_at desc);

create index if not exists aevonsmp_forum_replies_visible_thread_idx
  on public.aevonsmp_forum_replies(thread_id, status, created_at asc);

create index if not exists aevonsmp_forum_reactions_thread_reply_idx
  on public.aevonsmp_forum_reactions(thread_id, reply_id, reaction);

create index if not exists aevonsmp_forum_reactions_reply_reaction_idx
  on public.aevonsmp_forum_reactions(reply_id, reaction);

create index if not exists gcash_tickets_user_updated_idx
  on public.gcash_tickets(user_id, updated_at desc);

create index if not exists marketplace_orders_user_created_idx
  on public.marketplace_orders(user_id, created_at desc);

create index if not exists marketplace_orders_gcash_admin_idx
  on public.marketplace_orders(payment_method, admin_hidden, created_at desc);

create index if not exists aevonsmp_orders_user_created_perf_idx
  on public.aevonsmp_orders(user_id, created_at desc);

analyze public.plugins;
analyze public.plugin_versions;
analyze public.user_plugins;
analyze public.licenses;
analyze public.aevonsmp_forum_threads;
analyze public.aevonsmp_forum_replies;
analyze public.aevonsmp_forum_reactions;
