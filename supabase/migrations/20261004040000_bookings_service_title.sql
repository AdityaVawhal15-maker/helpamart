-- =============================================================================
-- HELPAMART — Add service_title column to public.bookings
-- Migration: 20261004040000_bookings_service_title.sql
--
-- The service_title column caches the human-readable service name so booking
-- history can display it without a join to the services JSONB array.
-- =============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_title TEXT;

-- Allow authenticated users to read their own bookings (as mentee or mentor)
-- These policies should already exist from 20261004020000, but guard with DROP IF EXISTS
DROP POLICY IF EXISTS "bookings_select_participant" ON public.bookings;
CREATE POLICY "bookings_select_participant"
  ON public.bookings FOR SELECT
  USING (
    auth.uid() = mentee_id
    OR auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id)
  );

-- Allow authenticated users to insert their own bookings (as mentee)
DROP POLICY IF EXISTS "bookings_insert_mentee" ON public.bookings;
CREATE POLICY "bookings_insert_mentee"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = mentee_id);

-- Allow participants to update (cancel) their own bookings
DROP POLICY IF EXISTS "bookings_update_participant" ON public.bookings;
CREATE POLICY "bookings_update_participant"
  ON public.bookings FOR UPDATE
  USING (
    auth.uid() = mentee_id
    OR auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id)
  );

NOTIFY pgrst, 'reload schema';
