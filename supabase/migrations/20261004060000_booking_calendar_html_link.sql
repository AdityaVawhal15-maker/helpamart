-- =============================================================================
-- HELPAMART — Add calendar_html_link to public.bookings
-- Migration: 20261004060000_booking_calendar_html_link.sql
--
-- Stores the Google Calendar event web URL (htmlLink) so the booking
-- confirmation page and history can show an "Open Google Calendar" button.
-- =============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS calendar_html_link TEXT;

NOTIFY pgrst, 'reload schema';
