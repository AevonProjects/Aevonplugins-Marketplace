-- Aevon Marketplace V2 - Admin plugin visibility
-- Safe to run more than once.
-- Public visitors still only see rows allowed by the existing "Public can view published plugins" policy.
-- This additional permissive policy lets authenticated admins also SELECT draft listings.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'plugins'
      AND policyname = 'Admins can view all plugins'
  ) THEN
    CREATE POLICY "Admins can view all plugins"
    ON public.plugins
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END
$$;
