-- ============================================================================
-- HELPAMART — Track Free First Session Per Mentor
-- Migration: 20261020000000_track_free_session_per_mentor.sql
--
-- Business rule:
-- Every newly approved/registered mentor gets exactly ONE free session:
-- their first eligible booking with their first student.
-- All subsequent sessions with that mentor cost ₹99.
--
-- Concurrency safeguard:
-- Ensure only one free session (price_cents = 0) with status confirmed/completed
-- can exist per mentor. Cancelled or failed sessions do not consume the entitlement.
-- ============================================================================

-- Index to accelerate mentor confirmed/completed session lookups
CREATE INDEX IF NOT EXISTS idx_bookings_mentor_confirmed_sessions
  ON public.bookings (mentor_id, status)
  WHERE status IN ('confirmed', 'completed');

-- Concurrency protection: partial unique index guaranteeing at most ONE active/completed
-- complimentary (price_cents = 0) session per mentor.
-- Cancelled/failed sessions do not block future free session bookings.
DO $$
BEGIN
  -- Safely create unique partial index if no existing historical duplicates violate it
  IF NOT EXISTS (
    SELECT mentor_id
    FROM public.bookings
    WHERE price_cents = 0 AND status IN ('confirmed', 'completed')
    GROUP BY mentor_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_free_session_per_mentor
      ON public.bookings (mentor_id)
      WHERE (price_cents = 0 AND status IN ('confirmed', 'completed'));
  END IF;
END $$;
