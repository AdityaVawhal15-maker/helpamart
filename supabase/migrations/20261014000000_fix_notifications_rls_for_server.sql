-- ============================================================================
-- HELPAMART — Fix Notifications RLS for Server-Side Inserts
-- Migration: 20261014000000_fix_notifications_rls_for_server.sql
--
-- CRITICAL FIX: The notifications table RLS policy was blocking server-side
-- (service_role) inserts despite GRANT ALL. This caused mentor notifications
-- to fail silently when api/book.ts tried to create them.
--
-- Root cause: RLS policy "notifications_user_own" was scoped only TO authenticated,
-- not TO service_role. Service role needs its own policy to bypass auth.uid() checks.
--
-- This migration is idempotent (uses DROP POLICY IF EXISTS).
-- ============================================================================

-- Add a service_role policy that allows all operations without auth.uid() constraint
-- This is necessary for Vercel server (using service_role key) to insert notifications
-- with arbitrary user_id values (e.g., mentor notifications)
DROP POLICY IF EXISTS "notifications_service_role_bypass" ON public.notifications;

CREATE POLICY "notifications_service_role_bypass"
  ON public.notifications
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify policies are in place
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'notifications';

NOTIFY pgrst, 'reload schema';
