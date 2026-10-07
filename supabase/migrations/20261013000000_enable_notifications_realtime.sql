-- ============================================================================
-- HELPAMART — Enable Supabase Realtime for Notifications
-- Migration: 20261013000000_enable_notifications_realtime.sql
--
-- CRITICAL: Adds public.notifications table to the supabase_realtime publication.
-- This allows:
--   1. Mentor bell notifications to update in realtime
--   2. Frontend subscribers to receive INSERT/UPDATE events
--   3. No page refresh needed for new booking notifications
--
-- Idempotent: Uses ADD TABLE IF NOT EXISTS (PostgreSQL 15+)
-- ============================================================================

-- Enable Realtime for notifications table (idempotent via IF NOT EXISTS)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.notifications;

-- Signal schema change
NOTIFY pgrst, 'reload schema';
