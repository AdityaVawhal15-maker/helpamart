-- =============================================================================
-- HELPAMART — Booking reminder idempotency columns
-- Migration: 20261004050000_booking_reminders.sql
--
-- Adds:
--   reminder_60_sent_at  — set when the 60-min reminder has been delivered
--   reminder_30_sent_at  — set when the 30-min reminder has been delivered
--   mentor_email         — cached mentor email (avoids join on every reminder)
--   student_email        — cached mentee email
--
-- The reminder worker (supabase/functions/send-reminders) checks IS NULL
-- before sending, then sets the timestamp.  This guarantees each reminder
-- is sent at most once even if the worker runs multiple times in the window.
-- =============================================================================

-- Reminder idempotency timestamps
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_60_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_30_sent_at  TIMESTAMPTZ;

-- Cached emails (already present in server/index.ts schema but may be missing
-- from the Supabase production bookings table created via 20261004020000)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS mentor_email   TEXT,
  ADD COLUMN IF NOT EXISTS student_email  TEXT;

-- Index so the reminder worker query is fast
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_window
  ON public.bookings (start_at, status)
  WHERE status = 'confirmed';

-- Index for reminder idempotency checks
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_60
  ON public.bookings (start_at)
  WHERE status = 'confirmed' AND reminder_60_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_reminder_30
  ON public.bookings (start_at)
  WHERE status = 'confirmed' AND reminder_30_sent_at IS NULL;

NOTIFY pgrst, 'reload schema';
