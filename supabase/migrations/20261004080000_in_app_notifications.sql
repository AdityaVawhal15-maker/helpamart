-- =============================================================================
-- HELPAMART — In-App Notifications & Meet Space
-- Migration: 20261004080000_in_app_notifications.sql
--
-- 1. In-app notifications table for mentees and mentors.
-- 2. Optional meet_space_name column on bookings for Google Meet space resource.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  link        TEXT,
  read        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users: can only see/modify their own notifications
DROP POLICY IF EXISTS "notifications_user_own" ON public.notifications;
CREATE POLICY "notifications_user_own"
  ON public.notifications FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CRITICAL: Policy for service_role (server-side): can insert notifications for any user
-- This is needed for api/book.ts to create notifications with user_id = mentorRow.user_id
-- Without this, service_role inserts are silently rejected by RLS despite GRANT ALL
DROP POLICY IF EXISTS "notifications_service_role_bypass" ON public.notifications;
CREATE POLICY "notifications_service_role_bypass"
  ON public.notifications
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Add meet_space_name to bookings if not already present
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meet_space_name TEXT;

NOTIFY pgrst, 'reload schema';
