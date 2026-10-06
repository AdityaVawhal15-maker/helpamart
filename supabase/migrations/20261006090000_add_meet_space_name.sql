-- =============================================================================
-- HELPAMART — Add meet_space_name column to bookings
-- Migration: 20261006090000_add_meet_space_name.sql
--
-- Google Meet REST API returns a space name (e.g., "abc-defg-hij") that uniquely
-- identifies the meeting space. This column stores that metadata for reference.
--
-- The critical field is meet_link (the real https://meet.google.com/... URL).
-- meet_space_name is optional metadata.
-- =============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS meet_space_name TEXT;

-- PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
