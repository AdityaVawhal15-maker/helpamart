-- ============================================================================
-- MIGRATION: Profile Views Tracking and Session Completion
-- Migration: 20261015000000_profile_views_and_completion.sql
-- Purpose: Track mentor profile views, deduplicate by visitor+mentor+time window,
--          and add completion tracking for bookings
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ADD profile_view_count COLUMN TO mentors TABLE
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.mentors 
ADD COLUMN IF NOT EXISTS profile_view_count INTEGER NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. CREATE profile_views TABLE
-- ────────────────────────────────────────────────────────────────────────────
-- Tracks each profile view event with deduplication by visitor+mentor+1hour window
-- Anonymous visitors (user_id IS NULL) are counted once per hour per mentor
-- Authenticated visitors (user_id NOT NULL) are counted once per hour per mentor

CREATE TABLE IF NOT EXISTS public.profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  visitor_id UUID,  -- NULL for anonymous visitors
  visitor_name TEXT,  -- Null for anonymous, stored from profiles.full_name for auth visitors
  visitor_avatar_url TEXT,  -- Null for anonymous, stored from profiles.avatar_url for auth visitors
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profile_views_mentor_id ON public.profile_views(mentor_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_visitor_id ON public.profile_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_at ON public.profile_views(viewed_at);

-- Composite index for deduplication check (mentor + visitor + 1-hour window)
CREATE INDEX IF NOT EXISTS idx_profile_views_dedup ON public.profile_views(
  mentor_id, 
  visitor_id, 
  viewed_at DESC
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. ADD completed_at COLUMN TO bookings TABLE
-- ────────────────────────────────────────────────────────────────────────────
-- Track when a booking was marked as completed (after session end)

ALTER TABLE IF EXISTS public.bookings 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for efficient completion queries
CREATE INDEX IF NOT EXISTS idx_bookings_completed ON public.bookings(mentor_id, status, completed_at);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS) POLICIES FOR profile_views
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT a profile view (authenticated or anonymous)
-- This allows tracking of views from public profile page
DROP POLICY IF EXISTS "Anyone can record profile views" ON public.profile_views;
CREATE POLICY "Anyone can record profile views" ON public.profile_views FOR INSERT 
  WITH CHECK (true);

-- Only the mentor who owns the profile can VIEW their profile views
DROP POLICY IF EXISTS "Mentors can view their own profile views" ON public.profile_views;
CREATE POLICY "Mentors can view their own profile views" ON public.profile_views FOR SELECT 
  USING (
    mentor_id IN (
      SELECT id FROM public.mentors WHERE user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 5. GRANTS FOR RLS
-- ────────────────────────────────────────────────────────────────────────────

-- Anonymous users can insert profile views (for anonymous visitor tracking)
GRANT INSERT ON public.profile_views TO anon;

-- Authenticated users can insert and select their own mentor's views
GRANT INSERT, SELECT ON public.profile_views TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. UPDATE mentors RLS POLICY - Allow reading profile_view_count for published
-- ────────────────────────────────────────────────────────────────────────────
-- No change needed - profile_view_count is part of mentors table which is 
-- already readable by authenticated users for their own profile

GRANT UPDATE(profile_view_count) ON public.bookings TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- SUMMARY OF CHANGES
-- ════════════════════════════════════════════════════════════════════════════
-- 
-- 1. Added profile_view_count column to mentors table (default 0)
-- 2. Created profile_views table with:
--    - mentor_id (who is being viewed)
--    - visitor_id (who is viewing, NULL for anonymous)
--    - visitor_name and visitor_avatar_url (for authenticated visitors)
--    - viewed_at timestamp
--    - Deduplication: one view per visitor per mentor per hour
-- 3. Added completed_at column to bookings table (for session completion tracking)
-- 4. Configured RLS policies:
--    - Anyone can insert profile views
--    - Only mentor can view their own profile views
-- 
-- ════════════════════════════════════════════════════════════════════════════
