-- =============================================================================
-- HELPAMART PRODUCTION DATABASE SCHEMA
-- Migration: 20261004020000_helpamart_production_schema.sql
--
-- This is the single authoritative migration for the helpamart.com Supabase
-- project.  It supersedes the two earlier partial migrations:
--   20261004000000_profiles_and_mentors.sql
--   20261004010000_complete_schema.sql
--
-- Safe to run on a completely empty schema (all statements use IF NOT EXISTS /
-- OR REPLACE / DO NOTHING semantics).
-- Safe to re-run — DROP POLICY IF EXISTS guards every policy.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0.  EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ===========================================================================
-- TABLE 1 — public.profiles
--
-- One row per auth.users entry.  Created automatically by the trigger below,
-- and upserted by the frontend on every sign-in.
--
-- Columns the app READS:  id, full_name, avatar_url
-- Columns the app WRITES: id, full_name, email, avatar_url, updated_at
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT        NOT NULL DEFAULT '',
  email         TEXT,
  phone         TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  location      TEXT,
  timezone      TEXT        NOT NULL DEFAULT 'UTC',
  languages     TEXT[]      DEFAULT '{"English"}',
  interests     TEXT[]      DEFAULT '{}',
  title         TEXT,
  company       TEXT,
  role          TEXT        NOT NULL DEFAULT 'user',  -- app-level role, NOT Supabase role
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.profiles IS
  'Mirror of auth.users enriched with app-level profile data.';


-- ===========================================================================
-- TABLE 2 — public.mentors
--
-- One row per mentor profile (UNIQUE on user_id → one mentor per user).
--
-- Columns the app WRITES (AuthContext.tsx → saveMentorProfile upsert):
--   id, user_id, slug, name, role, company, location, intro, about,
--   photo_url, languages, years_experience, linkedin_url, website_url,
--   education, companies, achievements, status, timezone,
--   categories, skills, updated_at, published_at (when publishing)
--
-- Columns the app READS (FindMentor.tsx, AuthContext.tsx):
--   All of the above PLUS:
--   buffer_minutes, advance_days, min_notice_hours, max_bookings_per_day,
--   services (JSONB), starting_price_cents, availability_preview
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.mentors (
  -- Identity
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL
                                   REFERENCES public.profiles(id)
                                   ON DELETE CASCADE
                                   UNIQUE,   -- one mentor profile per user
  slug                 TEXT        NOT NULL UNIQUE,

  -- Public profile fields
  name                 TEXT        NOT NULL DEFAULT '',
  role                 TEXT        NOT NULL DEFAULT '',
  company              TEXT        NOT NULL DEFAULT '',
  location             TEXT        NOT NULL DEFAULT '',
  intro                TEXT        NOT NULL DEFAULT '',
  about                TEXT        NOT NULL DEFAULT '',
  photo_url            TEXT,

  -- Arrays stored as native Postgres arrays
  languages            TEXT[]      NOT NULL DEFAULT '{"English"}',
  categories           TEXT[]      NOT NULL DEFAULT '{}',
  skills               TEXT[]      NOT NULL DEFAULT '{}',
  education            TEXT[]      NOT NULL DEFAULT '{}',
  companies            TEXT[]      NOT NULL DEFAULT '{}',
  achievements         TEXT[]      NOT NULL DEFAULT '{}',

  -- Professional details
  years_experience     INTEGER,
  linkedin_url         TEXT,
  website_url          TEXT,
  timezone             TEXT        NOT NULL DEFAULT 'UTC',

  -- Publication state
  -- CHECK constraint mirrors the TypeScript union 'draft' | 'published' | 'paused'
  status               TEXT        NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft', 'published', 'paused')),

  -- Booking configuration (read by discovery / availability pages)
  buffer_minutes       INTEGER     NOT NULL DEFAULT 15,
  advance_days         INTEGER     NOT NULL DEFAULT 30,
  min_notice_hours     INTEGER     NOT NULL DEFAULT 24,
  max_bookings_per_day INTEGER     NOT NULL DEFAULT 4,

  -- Services stored as JSONB so the app can read/write them without a join
  -- Schema per item: { id, title, description, durationMinutes, priceCents,
  --                    currency, format, active }
  services             JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Computed/cached values (written by the app)
  starting_price_cents INTEGER,
  availability_preview TEXT,        -- e.g. "Available Thu 3 pm"

  -- Timestamps
  created_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  published_at         TIMESTAMPTZ
);

COMMENT ON TABLE public.mentors IS
  'One mentor profile per authenticated user.  source of truth for mentor discovery.';

COMMENT ON COLUMN public.mentors.services IS
  'JSONB array of MentorService objects kept in sync by the frontend.';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_mentors_status
  ON public.mentors (status);

CREATE INDEX IF NOT EXISTS idx_mentors_slug
  ON public.mentors (slug);

CREATE INDEX IF NOT EXISTS idx_mentors_user_id
  ON public.mentors (user_id);

CREATE INDEX IF NOT EXISTS idx_mentors_categories
  ON public.mentors USING GIN (categories);

CREATE INDEX IF NOT EXISTS idx_mentors_published_at
  ON public.mentors (published_at DESC)
  WHERE status = 'published';


-- ===========================================================================
-- TABLE 3 — public.bookings
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id          UUID        NOT NULL REFERENCES public.mentors(id)  ON DELETE CASCADE,
  mentee_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id         TEXT        NOT NULL,
  mentor_email       TEXT,
  student_email      TEXT,
  start_at           TIMESTAMPTZ NOT NULL,
  end_at             TIMESTAMPTZ NOT NULL,
  timezone           TEXT        NOT NULL DEFAULT 'UTC',
  status             TEXT        NOT NULL DEFAULT 'confirmed'
                                 CHECK (status IN ('pending','confirmed','cancelled','completed')),
  payment_status     TEXT        NOT NULL DEFAULT 'not_required',
  price_cents        INTEGER     NOT NULL DEFAULT 0,
  currency           TEXT        NOT NULL DEFAULT 'INR',
  meet_link          TEXT,
  calendar_event_id  TEXT,
  calendar_status    TEXT,
  notes              TEXT,
  stripe_session_id  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_bookings_mentor_start
  ON public.bookings (mentor_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_bookings_mentee_id
  ON public.bookings (mentee_id);


-- ===========================================================================
-- TABLE 4 — public.calendar_connections  (Google Calendar OAuth tokens)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL
                            REFERENCES public.profiles(id)
                            ON DELETE CASCADE
                            UNIQUE,
  provider      TEXT        NOT NULL DEFAULT 'google',
  access_token  TEXT,
  refresh_token TEXT,
  expiry        TIMESTAMPTZ,
  account_email TEXT,
  calendar_id   TEXT        DEFAULT 'primary',
  status        TEXT        NOT NULL DEFAULT 'disconnected',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);


-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

-- Enable RLS on all application tables
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- PROFILES policies
-- ---------------------------------------------------------------------------

-- Anyone (including unauthenticated visitors) can read profiles.
-- This is required because mentor cards show the mentor's display name/avatar.
DROP POLICY IF EXISTS "profiles_select_all"  ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

-- A user can only insert their own profile row.
DROP POLICY IF EXISTS "profiles_insert_own"  ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- A user can only update their own profile row.
DROP POLICY IF EXISTS "profiles_update_own"  ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING     (auth.uid() = id)
  WITH CHECK(auth.uid() = id);


-- ---------------------------------------------------------------------------
-- MENTORS policies
-- ---------------------------------------------------------------------------

-- Rule 1: Any visitor can read a mentor whose status = 'published'.
-- Rule 2: The owning mentor can always read their own row (even when draft).
-- Combined into one policy with OR so the PostgREST planner uses a single scan.
DROP POLICY IF EXISTS "mentors_select"  ON public.mentors;
CREATE POLICY "mentors_select"
  ON public.mentors FOR SELECT
  USING (
    status = 'published'
    OR auth.uid() = user_id
  );

-- An authenticated user may insert exactly one mentor row for themselves.
DROP POLICY IF EXISTS "mentors_insert_own"  ON public.mentors;
CREATE POLICY "mentors_insert_own"
  ON public.mentors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- A mentor may update only their own row.
DROP POLICY IF EXISTS "mentors_update_own"  ON public.mentors;
CREATE POLICY "mentors_update_own"
  ON public.mentors FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- A mentor may delete only their own row.
DROP POLICY IF EXISTS "mentors_delete_own"  ON public.mentors;
CREATE POLICY "mentors_delete_own"
  ON public.mentors FOR DELETE
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- BOOKINGS policies
-- ---------------------------------------------------------------------------

-- A user can see bookings where they are the student OR the mentor.
DROP POLICY IF EXISTS "bookings_select_participant"  ON public.bookings;
CREATE POLICY "bookings_select_participant"
  ON public.bookings FOR SELECT
  USING (
    auth.uid() = mentee_id
    OR auth.uid() IN (
      SELECT user_id FROM public.mentors WHERE id = mentor_id
    )
  );

-- Only the student (mentee) may create a booking.
DROP POLICY IF EXISTS "bookings_insert_mentee"  ON public.bookings;
CREATE POLICY "bookings_insert_mentee"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = mentee_id);

-- Either participant may update (e.g. cancel, confirm) a booking.
DROP POLICY IF EXISTS "bookings_update_participant"  ON public.bookings;
CREATE POLICY "bookings_update_participant"
  ON public.bookings FOR UPDATE
  USING (
    auth.uid() = mentee_id
    OR auth.uid() IN (
      SELECT user_id FROM public.mentors WHERE id = mentor_id
    )
  );


-- ---------------------------------------------------------------------------
-- CALENDAR CONNECTIONS policies
-- ---------------------------------------------------------------------------

-- Owner-only access to their own calendar token.
DROP POLICY IF EXISTS "calendar_connections_own"  ON public.calendar_connections;
CREATE POLICY "calendar_connections_own"
  ON public.calendar_connections FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);


-- ===========================================================================
-- DATA API GRANTS
--
-- PostgREST uses the `anon` role for unauthenticated requests and the
-- `authenticated` role for requests that carry a valid JWT.
-- Without these grants the Data API returns 403 even when RLS would allow.
-- ===========================================================================

-- profiles
GRANT SELECT              ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- mentors — anon can SELECT (published ones filtered by RLS above)
GRANT SELECT              ON public.mentors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentors TO authenticated;

-- bookings — authenticated only
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;

-- calendar_connections — authenticated only, owner-only via RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_connections TO authenticated;


-- ===========================================================================
-- AUTH TRIGGER — auto-create profile row for every new Supabase user
--
-- Fires on INSERT *and* UPDATE so that OAuth logins that update name/avatar
-- also keep the profile in sync.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      ''
    ),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NULL
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET
      full_name  = COALESCE(
                     NULLIF(EXCLUDED.full_name, ''),
                     public.profiles.full_name
                   ),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      email      = COALESCE(EXCLUDED.email,      public.profiles.email),
      updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================================================
-- SCHEMA CACHE RELOAD
--
-- After DDL changes PostgREST needs to reload its schema cache.
-- On managed Supabase this happens automatically within ~30 s, but calling
-- pg_notify() forces an immediate reload without a server restart.
-- ===========================================================================
NOTIFY pgrst, 'reload schema';
